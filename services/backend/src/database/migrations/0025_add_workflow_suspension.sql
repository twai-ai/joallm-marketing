-- Durable workflow execution: suspend / resume support
-- Adds checkpoint and resume_trigger columns to workflow_executions,
-- extends the status constraint to include 'suspended', and creates a
-- partial index for fast suspended-execution lookups by the queue worker.

-- 1. Drop the existing status CHECK constraint (Drizzle text enum → CHECK in Postgres)
ALTER TABLE workflow_executions
  DROP CONSTRAINT IF EXISTS workflow_executions_status_check;

-- 2. Re-add with 'suspended' included
ALTER TABLE workflow_executions
  ADD CONSTRAINT workflow_executions_status_check
  CHECK (status IN ('running', 'completed', 'failed', 'cancelled', 'suspended'));

-- 3. Checkpoint: serialised DAG state at the moment of suspension
--    Stores structural data only (completed node IDs, pending counts, enabled set,
--    and lightweight context refs — not raw content blobs).
ALTER TABLE workflow_executions
  ADD COLUMN IF NOT EXISTS checkpoint JSONB;

-- 4. Resume trigger: describes which external event should wake this execution
--    Shape: { nodeId, jobType, externalJobId, fileId }
ALTER TABLE workflow_executions
  ADD COLUMN IF NOT EXISTS resume_trigger JSONB;

-- 5. Partial index: the queue worker queries suspended executions by executionId
--    directly (embedded in the BullMQ job data), but this index also supports
--    fallback look-ups by fileId + jobType if needed.
CREATE INDEX IF NOT EXISTS workflow_executions_suspended_trigger_idx
  ON workflow_executions (status, (resume_trigger->>'fileId'), (resume_trigger->>'jobType'))
  WHERE status = 'suspended';
