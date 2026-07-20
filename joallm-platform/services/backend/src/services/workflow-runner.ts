import { and, eq } from 'drizzle-orm';
import { db } from '../database/connection.js';
import { workflows, workflowExecutions } from '../database/schema.js';
import { userApiKeyRepository } from '../repositories/user-api-key-repository.js';
import { logger } from '../utils/logger.js';
import { workflowExecutor, WorkflowCheckpoint } from './workflow-executor.js';

// ── Run a workflow execution (first run) ─────────────────────────────────────

export async function runWorkflowExecution(executionId: string): Promise<void> {
  const [execution] = await db
    .select()
    .from(workflowExecutions)
    .where(eq(workflowExecutions.id, executionId))
    .limit(1);

  if (!execution) {
    throw new Error(`Workflow execution not found: ${executionId}`);
  }

  if (execution.status === 'cancelled' || execution.status === 'completed') {
    logger.info(`Skipping workflow execution ${executionId} — already ${execution.status}`);
    return;
  }

  const [workflow] = await db
    .select()
    .from(workflows)
    .where(eq(workflows.id, execution.workflowId!))
    .limit(1);

  if (!workflow) {
    throw new Error(`Workflow not found for execution ${executionId}`);
  }

  const rawKeys = await userApiKeyRepository.getDecryptedApiKeys(execution.userId!);
  const userApiKeys: Record<string, string> = Object.fromEntries(
    Object.entries(rawKeys).filter(([, value]) => value !== undefined)
  ) as Record<string, string>;

  const wfNodes = (workflow.nodes as any[]) || [];
  const wfEdges = (workflow.edges as any[]) || [];
  const input = (execution.input as Record<string, any>) || {};

  const result = await workflowExecutor.execute(
    wfNodes,
    wfEdges,
    input,
    userApiKeys,
    async () => {
      const [latest] = await db
        .select({ status: workflowExecutions.status })
        .from(workflowExecutions)
        .where(eq(workflowExecutions.id, executionId))
        .limit(1);
      return latest?.status === 'cancelled';
    },
    {
      executionId: execution.id,
      workflowId: execution.workflowId ?? undefined,
      userId: execution.userId ?? undefined,
    }
  );

  if (result.status === 'suspended') {
    await db
      .update(workflowExecutions)
      .set({
        status: 'suspended',
        checkpoint: result.checkpoint as any,
        resumeTrigger: result.resumeTrigger as any,
        executionLog: result.executionLog as any,
      })
      .where(eq(workflowExecutions.id, executionId));
    logger.info(`Workflow execution ${executionId} suspended — waiting for ${JSON.stringify(result.resumeTrigger)}`);
    return;
  }

  if (result.status === 'cancelled') {
    await db
      .update(workflowExecutions)
      .set({
        status: 'cancelled',
        output: result.output,
        completedAt: new Date(),
        executionLog: result.executionLog as any,
      })
      .where(eq(workflowExecutions.id, executionId));
    return;
  }

  await db
    .update(workflowExecutions)
    .set({
      status: result.status,
      output: result.output,
      error: result.status === 'failed' ? String(result.output?.error ?? 'Workflow execution failed') : null,
      completedAt: new Date(),
      executionLog: result.executionLog as any,
    })
    .where(eq(workflowExecutions.id, executionId));
}

// ── Resume a suspended workflow execution ─────────────────────────────────────

/**
 * Called by the media worker when an async BullMQ job (extract_audio /
 * extract_frames) completes. Loads the checkpoint, merges the job result into
 * the context, and re-runs the DAG from the suspension point.
 *
 * Uses an optimistic lock (UPDATE WHERE status='suspended') to ensure only one
 * caller wins if the same event fires concurrently (e.g. a retried BullMQ job).
 *
 * @param executionId     The workflow_executions row to resume
 * @param injectedContext Outputs from the completed async job
 */
export async function resumeWorkflowExecution(
  executionId: string,
  injectedContext: Record<string, any>
): Promise<void> {
  // Optimistic lock: atomically transition suspended → running
  // Only one concurrent caller will see the row change
  await db
    .update(workflowExecutions)
    .set({ status: 'running' })
    .where(
      and(
        eq(workflowExecutions.id, executionId),
        eq(workflowExecutions.status, 'suspended')
      )
    );

  // Verify we won the race
  const [execution] = await db
    .select()
    .from(workflowExecutions)
    .where(eq(workflowExecutions.id, executionId))
    .limit(1);

  if (!execution) {
    logger.warn(`resumeWorkflowExecution: execution not found: ${executionId}`);
    return;
  }

  if (execution.status !== 'running') {
    logger.warn(`resumeWorkflowExecution: lost resume race for ${executionId} (status=${execution.status}) — another process got it`);
    return;
  }

  if (!execution.checkpoint) {
    logger.error(`resumeWorkflowExecution: execution ${executionId} has no checkpoint — cannot resume`);
    await db
      .update(workflowExecutions)
      .set({ status: 'failed', error: 'Resume attempted but no checkpoint found' })
      .where(eq(workflowExecutions.id, executionId));
    return;
  }

  const [workflow] = await db
    .select()
    .from(workflows)
    .where(eq(workflows.id, execution.workflowId!))
    .limit(1);

  if (!workflow) {
    logger.error(`resumeWorkflowExecution: workflow not found for execution ${executionId}`);
    await db
      .update(workflowExecutions)
      .set({ status: 'failed', error: 'Workflow not found on resume' })
      .where(eq(workflowExecutions.id, executionId));
    return;
  }

  const rawKeys = await userApiKeyRepository.getDecryptedApiKeys(execution.userId!);
  const userApiKeys: Record<string, string> = Object.fromEntries(
    Object.entries(rawKeys).filter(([, value]) => value !== undefined)
  ) as Record<string, string>;

  const checkpoint = execution.checkpoint as WorkflowCheckpoint;
  const wfNodes = (workflow.nodes as any[]) || [];
  const wfEdges = (workflow.edges as any[]) || [];
  const previousLog = (execution.executionLog as any[]) || [];
  const resumeNodeId = (execution.resumeTrigger as any)?.nodeId as string | undefined;

  const result = await workflowExecutor.resumeFromCheckpoint(
    checkpoint,
    injectedContext,
    wfNodes,
    wfEdges,
    resumeNodeId,
    userApiKeys,
    async () => {
      const [latest] = await db
        .select({ status: workflowExecutions.status })
        .from(workflowExecutions)
        .where(eq(workflowExecutions.id, executionId))
        .limit(1);
      return latest?.status === 'cancelled';
    },
    {
      executionId: execution.id,
      workflowId: execution.workflowId ?? undefined,
      userId: execution.userId ?? undefined,
    }
  );

  // Merge logs from both runs for a complete audit trail
  const mergedLog = [...previousLog, ...result.executionLog];

  if (result.status === 'suspended') {
    // Chained suspension (e.g. transcribe → media_insights in the same workflow)
    await db
      .update(workflowExecutions)
      .set({
        status: 'suspended',
        checkpoint: result.checkpoint as any,
        resumeTrigger: result.resumeTrigger as any,
        executionLog: mergedLog as any,
      })
      .where(eq(workflowExecutions.id, executionId));
    logger.info(`Workflow execution ${executionId} re-suspended — waiting for ${JSON.stringify(result.resumeTrigger)}`);
    return;
  }

  if (result.status === 'cancelled') {
    await db
      .update(workflowExecutions)
      .set({
        status: 'cancelled',
        output: result.output,
        completedAt: new Date(),
        executionLog: mergedLog as any,
      })
      .where(eq(workflowExecutions.id, executionId));
    return;
  }

  await db
    .update(workflowExecutions)
    .set({
      status: result.status,
      output: result.output,
      error: result.status === 'failed' ? String(result.output?.error ?? 'Workflow execution failed') : null,
      completedAt: new Date(),
      executionLog: mergedLog as any,
      checkpoint: null,
      resumeTrigger: null,
    })
    .where(eq(workflowExecutions.id, executionId));

  logger.info(`Workflow execution ${executionId} ${result.status}`);
}
