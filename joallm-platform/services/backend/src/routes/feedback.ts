import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import { db } from '../database/connection.js';
import {
  messageFeedback,
  messages,
  trainingConsent,
  chatSessions,
} from '../database/schema.js';
import { eq, and } from 'drizzle-orm';
import { logger } from '../utils/logger.js';
import { authenticateToken } from '../middleware/auth.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

const FeedbackSchema = z.object({
  rating: z.enum(['thumbs_up', 'thumbs_down']),
  feedbackType: z.enum(['rating', 'correction', 'flag']).default('rating'),
  correctedText: z.string().max(10000).optional(),
  flagReason: z.enum(['wrong', 'harmful', 'off_topic', 'incomplete']).optional(),
});

const ConsentSchema = z.object({
  consentGiven: z.boolean(),
  consentVersion: z.string().default('v1.0'),
});

export async function feedbackRoutes(fastify: FastifyInstance, _options: FastifyPluginOptions) {

  // POST /api/feedback/messages/:messageId
  // Submit or update feedback for an assistant message
  fastify.post('/messages/:messageId', {
    preHandler: [authenticateToken],
    schema: {
      description: 'Submit thumbs up/down feedback for an assistant message',
      tags: ['feedback'],
      params: { type: 'object', properties: { messageId: { type: 'string' } }, required: ['messageId'] },
      body: {
        type: 'object',
        required: ['rating'],
        properties: {
          rating: { type: 'string', enum: ['thumbs_up', 'thumbs_down'] },
          feedbackType: { type: 'string', enum: ['rating', 'correction', 'flag'] },
          correctedText: { type: 'string' },
          flagReason: { type: 'string', enum: ['wrong', 'harmful', 'off_topic', 'incomplete'] },
        },
      },
    },
  }, async (request, reply) => {
    const { messageId } = request.params as { messageId: string };
    const userId = (request as any).user.id;
    const body = FeedbackSchema.parse(request.body);

    try {
      if (!isUuid(messageId)) {
        return reply.status(400).send({ error: 'Invalid message id' });
      }

      // Verify the message exists and belongs to a session the user owns
      const [message] = await db
        .select({ id: messages.id, sessionId: messages.sessionId, role: messages.role })
        .from(messages)
        .where(eq(messages.id, messageId))
        .limit(1);

      if (!message) {
        return reply.status(404).send({ error: 'Message not found' });
      }

      // Only assistant messages can be rated
      if (message.role !== 'assistant') {
        return reply.status(400).send({ error: 'Only assistant messages can receive feedback' });
      }

      // Verify session ownership
      if (message.sessionId) {
        const [session] = await db
          .select({ userId: chatSessions.userId })
          .from(chatSessions)
          .where(eq(chatSessions.id, message.sessionId))
          .limit(1);

        if (session?.userId && session.userId !== userId) {
          return reply.status(403).send({ error: 'Access denied' });
        }
      }

      // Upsert feedback (one record per user per message)
      const [result] = await db
        .insert(messageFeedback)
        .values({
          messageId,
          userId,
          sessionId: message.sessionId,
          rating: body.rating,
          feedbackType: body.feedbackType,
          correctedText: body.correctedText,
          flagReason: body.flagReason,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [messageFeedback.messageId, messageFeedback.userId],
          set: {
            rating: body.rating,
            feedbackType: body.feedbackType,
            correctedText: body.correctedText,
            flagReason: body.flagReason,
            updatedAt: new Date(),
          },
        })
        .returning();

      return reply.status(200).send({
        id: result.id,
        messageId: result.messageId,
        rating: result.rating,
        feedbackType: result.feedbackType,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
      });
    } catch (error) {
      logger.error('Failed to submit message feedback:', error);
      return reply.status(500).send({ error: 'Failed to submit feedback' });
    }
  });

  // GET /api/feedback/messages/:messageId
  // Get the requesting user's feedback for a specific message
  fastify.get('/messages/:messageId', {
    preHandler: [authenticateToken],
    schema: {
      description: 'Get feedback for a message submitted by the current user',
      tags: ['feedback'],
      params: { type: 'object', properties: { messageId: { type: 'string' } }, required: ['messageId'] },
    },
  }, async (request, reply) => {
    const { messageId } = request.params as { messageId: string };
    const userId = (request as any).user.id;

    try {
      if (!isUuid(messageId)) {
        return reply.status(200).send({ feedback: null });
      }

      const [feedback] = await db
        .select()
        .from(messageFeedback)
        .where(and(eq(messageFeedback.messageId, messageId), eq(messageFeedback.userId, userId)))
        .limit(1);

      if (!feedback) {
        return reply.status(200).send({ feedback: null });
      }

      return reply.send({
        feedback: {
          id: feedback.id,
          rating: feedback.rating,
          feedbackType: feedback.feedbackType,
          correctedText: feedback.correctedText,
          flagReason: feedback.flagReason,
          createdAt: feedback.createdAt,
          updatedAt: feedback.updatedAt,
        },
      });
    } catch (error) {
      logger.error('Failed to get message feedback:', error);
      return reply.status(500).send({ error: 'Failed to get feedback' });
    }
  });

  // DELETE /api/feedback/messages/:messageId
  // Retract feedback
  fastify.delete('/messages/:messageId', {
    preHandler: [authenticateToken],
    schema: {
      description: 'Retract feedback for a message',
      tags: ['feedback'],
      params: { type: 'object', properties: { messageId: { type: 'string' } }, required: ['messageId'] },
    },
  }, async (request, reply) => {
    const { messageId } = request.params as { messageId: string };
    const userId = (request as any).user.id;

    try {
      if (!isUuid(messageId)) {
        return reply.send({ success: true });
      }

      await db
        .delete(messageFeedback)
        .where(and(eq(messageFeedback.messageId, messageId), eq(messageFeedback.userId, userId)));

      return reply.send({ success: true });
    } catch (error) {
      logger.error('Failed to delete feedback:', error);
      return reply.status(500).send({ error: 'Failed to delete feedback' });
    }
  });

  // PATCH /api/feedback/training-consent
  // Opt in or out of training data usage
  fastify.patch('/training-consent', {
    preHandler: [authenticateToken],
    schema: {
      description: 'Update training data consent for the current user',
      tags: ['feedback'],
      body: {
        type: 'object',
        required: ['consentGiven'],
        properties: {
          consentGiven: { type: 'boolean' },
          consentVersion: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const userId = (request as any).user.id;
    const { consentGiven, consentVersion } = ConsentSchema.parse(request.body);

    try {
      const now = new Date();

      const [result] = await db
        .insert(trainingConsent)
        .values({
          userId,
          consentGiven,
          consentVersion,
          givenAt: consentGiven ? now : null,
          revokedAt: consentGiven ? null : now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [trainingConsent.userId],
          set: {
            consentGiven,
            consentVersion,
            givenAt: consentGiven ? now : undefined,
            revokedAt: consentGiven ? null : now,
            updatedAt: now,
          },
        })
        .returning();

      return reply.send({
        consentGiven: result.consentGiven,
        consentVersion: result.consentVersion,
        givenAt: result.givenAt,
        revokedAt: result.revokedAt,
        updatedAt: result.updatedAt,
      });
    } catch (error) {
      logger.error('Failed to update training consent:', error);
      return reply.status(500).send({ error: 'Failed to update training consent' });
    }
  });

  // GET /api/feedback/training-consent
  // Get current consent state
  fastify.get('/training-consent', {
    preHandler: [authenticateToken],
    schema: {
      description: 'Get training data consent status for the current user',
      tags: ['feedback'],
    },
  }, async (request, reply) => {
    const userId = (request as any).user.id;

    try {
      const [consent] = await db
        .select()
        .from(trainingConsent)
        .where(eq(trainingConsent.userId, userId))
        .limit(1);

      return reply.send({
        consentGiven: consent?.consentGiven ?? false,
        consentVersion: consent?.consentVersion ?? 'v1.0',
        givenAt: consent?.givenAt ?? null,
        revokedAt: consent?.revokedAt ?? null,
      });
    } catch (error) {
      logger.error('Failed to get training consent:', error);
      return reply.status(500).send({ error: 'Failed to get training consent' });
    }
  });
}
