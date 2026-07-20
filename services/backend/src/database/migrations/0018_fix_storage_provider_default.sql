-- Migration 0018: Fix storage_provider default to 'volume' (safe default for non-R2 deployments)
-- Also backfills existing NULL or 'cloudflare-r2' rows that were actually stored on volume.
-- Going forward, files.ts sets storageProvider explicitly from config.storageProvider.

ALTER TABLE files
  ALTER COLUMN storage_provider SET DEFAULT 'volume';

-- Backfill rows where storage_key is NULL (never uploaded to R2/S3) but storage_provider
-- still says 'cloudflare-r2' — those were processed in memory only, correct them to 'volume'.
UPDATE files
SET storage_provider = 'volume'
WHERE storage_key IS NULL
  AND storage_provider = 'cloudflare-r2';
