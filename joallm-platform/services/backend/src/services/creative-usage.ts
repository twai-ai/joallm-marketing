/**
 * Persist Creative AI (Ideogram / FLUX) usage into api_usage for Plan & Usage.
 */

import { db } from '../database/connection.js';
import { apiUsage } from '../database/schema.js';
import {
  estimateCreativeImageCost,
  formatCost,
  type CreativeImageCostEstimate,
} from '../utils/cost-calculator.js';
import { logger } from '../utils/logger.js';

export type CreativeUsageRecord = CreativeImageCostEstimate & {
  keySource?: 'byok' | 'platform';
  latencyMs?: number;
  endpoint?: string;
};

export async function recordCreativeImageUsage(options: {
  userId: string;
  provider: 'ideogram' | 'flux';
  modelId: string;
  quality?: string;
  imageCount: number;
  hasReferences?: boolean;
  latencyMs?: number;
  keySource?: 'byok' | 'platform';
  /** Override endpoint label (default generate-image) */
  endpoint?: string;
  source?: string;
}): Promise<CreativeUsageRecord | null> {
  const estimate = estimateCreativeImageCost({
    provider: options.provider,
    modelId: options.modelId,
    quality: options.quality,
    imageCount: options.imageCount,
    hasReferences: options.hasReferences,
  });

  const endpoint =
    options.endpoint ||
    (options.source ? `/api/creative/${options.source}` : '/api/creative/generate-image');

  try {
    await db.insert(apiUsage).values({
      userId: options.userId,
      endpoint,
      method: 'POST',
      model: `${options.provider}:${options.modelId}`,
      // Store image count here so dashboards that sum tokens still show volume
      tokensUsed: options.imageCount,
      cost: estimate.estimatedCostCents,
      responseTime: options.latencyMs ?? null,
      statusCode: 200,
    });
  } catch (error) {
    logger.warn('Failed to record Creative AI usage', {
      error: error instanceof Error ? error.message : String(error),
      userId: options.userId,
      provider: options.provider,
    });
    // Still return estimate for the response toast even if DB write failed
  }

  return {
    ...estimate,
    keySource: options.keySource,
    latencyMs: options.latencyMs,
    endpoint,
  };
}

export function formatCreativeUsageSummary(usage: CreativeUsageRecord | null | undefined): string {
  if (!usage) return '';
  const who = usage.keySource === 'byok' ? 'your key' : 'platform key';
  return `${usage.imageCount}× ${usage.provider} · ~${usage.estimatedCredits} credit${
    usage.estimatedCredits === 1 ? '' : 's'
  } (~${formatCost(usage.estimatedCostCents)}) · ${who}`;
}
