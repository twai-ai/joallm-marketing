/**
 * Resolve Creative AI provider API keys from the shared Settings BYOK store
 * (users.api_keys — same encrypted blob as LLM keys).
 */

import { userApiKeyRepository } from '../repositories/user-api-key-repository.js';
import type { ImageGenerationProviderId } from './creative-ai-registry.js';

/** Map Creative AI provider → Settings api_keys slot(s), first match wins */
const PROVIDER_KEY_SLOTS: Record<
  Exclude<ImageGenerationProviderId, 'auto' | 'custom'>,
  string[]
> = {
  openai: ['openai'],
  google_imagen: ['google_imagen', 'google'],
  flux: ['flux', 'bfl', 'black_forest_labs', 'blackforest'],
  ideogram: ['ideogram'],
  stability: ['stability'],
  adobe_firefly: ['adobe_firefly', 'adobe'],
};

function platformFallback(provider: ImageGenerationProviderId): string | undefined {
  if (provider === 'openai') return process.env.OPENAI_API_KEY;
  if (provider === 'google_imagen') {
    return process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_IMAGEN_API_KEY;
  }
  if (provider === 'flux') return process.env.BFL_API_KEY || process.env.FLUX_API_KEY;
  if (provider === 'ideogram') return process.env.IDEOGRAM_API_KEY;
  if (provider === 'stability') return process.env.STABILITY_API_KEY;
  if (provider === 'adobe_firefly') return process.env.ADOBE_FIREFLY_API_KEY;
  return undefined;
}

export async function resolveCreativeProviderApiKey(
  userId: string,
  provider: ImageGenerationProviderId,
): Promise<{ key?: string; source: 'byok' | 'platform' | 'none'; slot?: string }> {
  if (provider === 'auto' || provider === 'custom') {
    return { source: 'none' };
  }

  const slots = PROVIDER_KEY_SLOTS[provider] || [provider];
  const keys = await userApiKeyRepository.getDecryptedApiKeys(userId);

  for (const slot of slots) {
    const value = keys[slot]?.trim();
    if (value) {
      return { key: value, source: 'byok', slot };
    }
  }

  const platform = platformFallback(provider)?.trim();
  if (platform) {
    return { key: platform, source: 'platform' };
  }

  return { source: 'none' };
}

export async function listConfiguredCreativeProviders(userId: string): Promise<{
  provider: Exclude<ImageGenerationProviderId, 'auto' | 'custom'>;
  configured: boolean;
  source: 'byok' | 'platform' | 'none';
}[]> {
  const providers = Object.keys(PROVIDER_KEY_SLOTS) as Array<
    Exclude<ImageGenerationProviderId, 'auto' | 'custom'>
  >;
  const results = [];
  for (const provider of providers) {
    const resolved = await resolveCreativeProviderApiKey(userId, provider);
    results.push({
      provider,
      configured: Boolean(resolved.key),
      source: resolved.source,
    });
  }
  return results;
}
