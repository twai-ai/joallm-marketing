/**
 * Subscription management routes.
 * - GET  /subscriptions/plans                  — list available plans with limits
 * - GET  /subscriptions/current                — get user's current plan + usage
 * - POST /subscriptions/checkout               — create or return a checkout link/session
 * - POST /subscriptions/webhook                — generic HMAC-signed webhook (internal)
 * - POST /subscriptions/webhook/lemonsqueezy   — Lemon Squeezy event webhook
 * - POST /subscriptions/webhook/razorpay       — Razorpay payment/subscription webhook
 * - GET  /subscriptions/usage                  — cost dashboard (tokens, requests, costs)
 */

import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import crypto from 'crypto';
import { db } from '../database/connection.js';
import { users, apiUsage } from '../database/schema.js';
import { eq, sql } from 'drizzle-orm';
import { logger } from '../utils/logger.js';
import { authenticateToken } from '../middleware/auth.js';
import { TIER_LIMITS, getTierLimits } from '../middleware/subscription.js';

const WEBHOOK_SECRET = process.env.SUBSCRIPTION_WEBHOOK_SECRET ?? '';
const LS_API_KEY = process.env.LEMONSQUEEZY_API_KEY ?? '';
const LS_WEBHOOK_SECRET = process.env.LEMONSQUEEZY_WEBHOOK_SECRET ?? '';
const LS_STORE_ID = process.env.LEMONSQUEEZY_STORE_ID ?? '';
const LS_VARIANT_ID = process.env.LEMONSQUEEZY_VARIANT_ID ?? '';
const RAZORPAY_PAYMENT_LINK_URL = process.env.RAZORPAY_PAYMENT_LINK_URL ?? '';
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID ?? '';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET ?? '';
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET ?? '';
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'https://platform.atrisi.org';

async function applyTierChange(userId: string, tier: 'free' | 'pro' | 'enterprise', event: string) {
  await db.update(users)
    .set({ subscriptionTier: tier, updatedAt: new Date() })
    .where(eq(users.id, userId));
  logger.info(`Set user ${userId} to ${tier} tier (event: ${event})`);
}

export async function subscriptionRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {

  // List all available plans
  fastify.get('/plans', {
    schema: {
      description: 'List available subscription plans and their limits',
      tags: ['subscriptions'],
    }
  }, async (request, reply) => {
    return reply.send({
      plans: [
        {
          id: 'free',
          name: 'Free',
          price: { monthly: 0, annual: 0 },
          limits: TIER_LIMITS.free,
        },
        {
          id: 'pro',
          name: 'Pro',
          price: { monthly: 2900, annual: 29000 }, // cents
          limits: TIER_LIMITS.pro,
        },
        {
          id: 'enterprise',
          name: 'Enterprise',
          price: { monthly: null, annual: null }, // Contact sales
          limits: TIER_LIMITS.enterprise,
        },
      ]
    });
  });

  // Get current user subscription + usage summary
  fastify.get('/current', {
    preHandler: authenticateToken,
    schema: {
      description: 'Get current subscription tier and usage statistics',
      tags: ['subscriptions'],
    }
  }, async (request, reply) => {
    const userId = (request as any).user.id;
    try {
      const [user] = await db.select({
        subscriptionTier: users.subscriptionTier,
        usageStats: users.usageStats,
      }).from(users).where(eq(users.id, userId)).limit(1);

      if (!user) return reply.status(404).send({ error: 'User not found' });

      const tier = user.subscriptionTier ?? 'free';
      const limits = getTierLimits(tier);

      return reply.send({
        tier,
        limits,
        usage: user.usageStats ?? { totalTokens: 0, totalRequests: 0, totalFiles: 0, lastReset: null },
      });
    } catch (error) {
      logger.error('Failed to get subscription:', error);
      return reply.status(500).send({ error: 'Failed to get subscription info' });
    }
  });

  // Cost/usage dashboard (last 30 days by default)
  fastify.get('/usage', {
    preHandler: authenticateToken,
    schema: {
      description: 'Get API usage and cost breakdown for the current user',
      tags: ['subscriptions'],
      querystring: {
        type: 'object',
        properties: {
          days: { type: 'number', default: 30 }
        }
      }
    }
  }, async (request, reply) => {
    const userId = (request as any).user.id;
    const { days = 30 } = request.query as { days?: number };
    try {
      const since = new Date(Date.now() - days * 86400_000);

      const rows = await db.select({
        date: sql<string>`DATE(${apiUsage.createdAt})`,
        totalRequests: sql<number>`COUNT(*)`,
        totalTokens: sql<number>`COALESCE(SUM(${apiUsage.tokensUsed}), 0)`,
        totalCostCents: sql<number>`COALESCE(SUM(${apiUsage.cost}), 0)`,
        models: sql<string[]>`array_agg(DISTINCT ${apiUsage.model}) FILTER (WHERE ${apiUsage.model} IS NOT NULL)`,
      })
        .from(apiUsage)
        .where(eq(apiUsage.userId, userId))
        .groupBy(sql`DATE(${apiUsage.createdAt})`)
        .orderBy(sql`DATE(${apiUsage.createdAt}) DESC`);

      const totals = rows.reduce((acc, r) => ({
        totalRequests: acc.totalRequests + Number(r.totalRequests),
        totalTokens: acc.totalTokens + Number(r.totalTokens),
        totalCostCents: acc.totalCostCents + Number(r.totalCostCents),
      }), { totalRequests: 0, totalTokens: 0, totalCostCents: 0 });

      return reply.send({ days, dailyBreakdown: rows, totals });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Failed to get usage:', error);
      // Fresh Marketing DBs may not have api_usage yet — don't break the home/settings UI
      if (/api_usage|does not exist/i.test(message)) {
        return reply.send({
          days,
          dailyBreakdown: [],
          totals: { totalRequests: 0, totalTokens: 0, totalCostCents: 0 },
        });
      }
      return reply.status(500).send({ error: 'Failed to get usage data' });
    }
  });

  /**
   * Create a checkout session or return a hosted payment link.
   * For MVP billing, Razorpay payment links can be used without a full provider SDK integration.
   */
  fastify.post('/checkout', {
    preHandler: authenticateToken,
    schema: {
      description: 'Create a checkout session or hosted payment link for Pro upgrade',
      tags: ['subscriptions'],
    },
  }, async (request, reply) => {
    const userId = (request as any).user.id;
    try {
      const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
      if (!user) return reply.status(404).send({ error: 'User not found' });

      if (RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET) {
        // Create a dynamic payment link so user_id is embedded in notes for webhook matching
        const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');
        const rzpResponse = await fetch('https://api.razorpay.com/v1/payment_links', {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount: 29000, // ₹290 in paise (founder's offer)
            currency: 'INR',
            description: 'JoaLLM Pro — Founder\'s Offer',
            customer: { email: user.email },
            notes: { user_id: userId },
            callback_url: `${FRONTEND_URL}/settings?upgrade=success`,
            callback_method: 'get',
          }),
        });

        if (!rzpResponse.ok) {
          const errText = await rzpResponse.text();
          logger.error(`Razorpay API error ${rzpResponse.status}: ${errText}`);
          return reply.status(502).send({ error: 'Failed to create Razorpay payment link' });
        }

        const rzpData = await rzpResponse.json() as any;
        const checkoutUrl = rzpData?.short_url;
        if (!checkoutUrl) {
          logger.error('Razorpay response missing short_url', rzpData);
          return reply.status(502).send({ error: 'Invalid Razorpay response' });
        }

        logger.info(`Created Razorpay payment link for user ${userId}`);
        return reply.send({ provider: 'razorpay', checkoutUrl });
      }

      if (RAZORPAY_PAYMENT_LINK_URL) {
        // Fallback: static payment link (no user_id tracking)
        logger.warn(`Using static Razorpay payment link for user ${userId} — tier won't auto-upgrade`);
        return reply.send({
          provider: 'razorpay',
          checkoutUrl: RAZORPAY_PAYMENT_LINK_URL,
        });
      }

      if (!LS_API_KEY || !LS_STORE_ID || !LS_VARIANT_ID) {
        logger.warn('No payment provider configured for checkout');
        return reply.status(503).send({ error: 'Payment provider not configured' });
      }

      const lsResponse = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LS_API_KEY}`,
          'Content-Type': 'application/vnd.api+json',
          'Accept': 'application/vnd.api+json',
        },
        body: JSON.stringify({
          data: {
            type: 'checkouts',
            attributes: {
              checkout_data: {
                email: user.email,
                custom: { user_id: userId },
              },
              product_options: {
                redirect_url: `${FRONTEND_URL}/settings?upgrade=success`,
                receipt_thank_you_note: 'Welcome to JoaLLM Pro! Your account will be upgraded within minutes.',
              },
            },
            relationships: {
              store: { data: { type: 'stores', id: LS_STORE_ID } },
              variant: { data: { type: 'variants', id: LS_VARIANT_ID } },
            },
          },
        }),
      });

      if (!lsResponse.ok) {
        const errorText = await lsResponse.text();
        logger.error(`Lemon Squeezy API error ${lsResponse.status}: ${errorText}`);
        return reply.status(502).send({ error: 'Failed to create checkout session' });
      }

      const lsData = await lsResponse.json() as any;
      const checkoutUrl = lsData?.data?.attributes?.url;

      if (!checkoutUrl) {
        logger.error('Lemon Squeezy response missing checkout URL', lsData);
        return reply.status(502).send({ error: 'Invalid checkout response' });
      }

      return reply.send({
        provider: 'lemonsqueezy',
        checkoutUrl,
      });
    } catch (error) {
      logger.error('Failed to create checkout session:', error);
      return reply.status(500).send({ error: 'Failed to create checkout session' });
    }
  });

  /**
   * Lemon Squeezy webhook handler.
   * Verifies X-Signature header (HMAC-SHA256 hex of raw body).
   * Maps LS events to internal tier changes using custom_data.user_id.
   */
  fastify.post('/webhook/lemonsqueezy', {
    schema: {
      description: 'Handle Lemon Squeezy subscription webhooks',
      tags: ['subscriptions'],
    },
    config: { rawBody: true },
  }, async (request, reply) => {
    try {
      if (LS_WEBHOOK_SECRET) {
        const signature = request.headers['x-signature'] as string;
        if (!signature) {
          return reply.status(401).send({ error: 'Missing X-Signature header' });
        }
        const rawBody = (request as any).rawBody ?? JSON.stringify(request.body);
        const expected = crypto.createHmac('sha256', LS_WEBHOOK_SECRET).update(rawBody).digest('hex');
        if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
          logger.warn('Lemon Squeezy webhook signature mismatch');
          return reply.status(401).send({ error: 'Invalid webhook signature' });
        }
      }

      const body = request.body as any;
      const eventName: string = body?.meta?.event_name ?? '';
      const userId: string = body?.meta?.custom_data?.user_id ?? '';

      if (!userId) {
        logger.warn(`Lemon Squeezy webhook ${eventName} missing custom_data.user_id`);
        // Return 200 so LS doesn't retry — we can't match without a userId
        return reply.send({ received: true, skipped: true });
      }

      switch (eventName) {
        case 'order_created':
        case 'subscription_created':
          await applyTierChange(userId, 'pro', eventName);
          break;
        case 'subscription_resumed':
        case 'subscription_payment_success':
          // Re-activation after pause/failed payment — ensure pro is set
          await applyTierChange(userId, 'pro', eventName);
          break;
        case 'subscription_cancelled':
        case 'subscription_expired':
        case 'subscription_payment_failed':
          await applyTierChange(userId, 'free', eventName);
          break;
        default:
          logger.info(`Lemon Squeezy: unhandled event "${eventName}" for user ${userId}`);
      }

      return reply.send({ received: true });
    } catch (error) {
      logger.error('Lemon Squeezy webhook processing failed:', error);
      return reply.status(500).send({ error: 'Webhook processing failed' });
    }
  });

  /**
   * Razorpay webhook handler.
   * Verifies X-Razorpay-Signature header (HMAC-SHA256 hex of raw body).
   * Reads user_id from payment link notes to map payments to users.
   * Supported events: payment_link.paid, payment.captured, subscription.activated,
   *   subscription.charged, subscription.cancelled, subscription.completed
   */
  fastify.post('/webhook/razorpay', {
    schema: {
      description: 'Handle Razorpay payment webhooks',
      tags: ['subscriptions'],
    },
    config: { rawBody: true },
  }, async (request, reply) => {
    try {
      if (RAZORPAY_WEBHOOK_SECRET) {
        const signature = request.headers['x-razorpay-signature'] as string;
        if (!signature) {
          return reply.status(401).send({ error: 'Missing X-Razorpay-Signature header' });
        }
        const rawBody = (request as any).rawBody ?? JSON.stringify(request.body);
        const expected = crypto.createHmac('sha256', RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest('hex');
        if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
          logger.warn('Razorpay webhook signature mismatch');
          return reply.status(401).send({ error: 'Invalid webhook signature' });
        }
      }

      const body = request.body as any;
      const event: string = body?.event ?? '';

      // Extract user_id from notes — present on payment_link and payment entities
      const userId: string =
        body?.payload?.payment_link?.entity?.notes?.user_id ??
        body?.payload?.payment?.entity?.notes?.user_id ??
        body?.payload?.subscription?.entity?.notes?.user_id ??
        '';

      if (!userId) {
        logger.warn(`Razorpay webhook "${event}" missing notes.user_id — cannot map to user`);
        return reply.send({ received: true, skipped: true });
      }

      switch (event) {
        case 'payment_link.paid':
        case 'payment.captured':
        case 'subscription.activated':
        case 'subscription.charged':
          await applyTierChange(userId, 'pro', event);
          break;
        case 'subscription.cancelled':
        case 'subscription.completed':
          await applyTierChange(userId, 'free', event);
          break;
        default:
          logger.info(`Razorpay: unhandled event "${event}" for user ${userId}`);
      }

      return reply.send({ received: true });
    } catch (error) {
      logger.error('Razorpay webhook processing failed:', error);
      return reply.status(500).send({ error: 'Webhook processing failed' });
    }
  });

  /**
   * Generic internal webhook endpoint.
   * Supports HMAC-SHA256 signature in X-Webhook-Signature header.
   * Body format: { event, userId, tier }
   */
  fastify.post('/webhook', {
    schema: {
      description: 'Handle subscription purchase/upgrade webhooks (internal)',
      tags: ['subscriptions'],
    },
    config: { rawBody: true },
  }, async (request, reply) => {
    try {
      if (WEBHOOK_SECRET) {
        const signature = request.headers['x-webhook-signature'] as string;
        if (!signature) {
          return reply.status(401).send({ error: 'Missing webhook signature' });
        }
        const rawBody = (request as any).rawBody ?? JSON.stringify(request.body);
        const expected = `sha256=${crypto.createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex')}`;
        if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
          logger.warn('Webhook signature mismatch');
          return reply.status(401).send({ error: 'Invalid webhook signature' });
        }
      }

      const { event, userId, tier } = request.body as { event: string; userId: string; tier: string };

      if (!userId || !tier) {
        return reply.status(400).send({ error: 'Missing userId or tier in payload' });
      }

      const validTiers = ['free', 'pro', 'enterprise'] as const;
      if (!validTiers.includes(tier as any)) {
        return reply.status(400).send({ error: `Invalid tier: ${tier}` });
      }

      switch (event) {
        case 'purchase.completed':
        case 'subscription.upgraded':
          await applyTierChange(userId, tier as 'free' | 'pro' | 'enterprise', event);
          break;
        case 'subscription.cancelled':
        case 'subscription.expired':
          await applyTierChange(userId, 'free', event);
          break;
        default:
          logger.warn(`Unhandled webhook event: ${event}`);
      }

      return reply.send({ received: true });
    } catch (error) {
      logger.error('Webhook processing failed:', error);
      return reply.status(500).send({ error: 'Webhook processing failed' });
    }
  });
}
