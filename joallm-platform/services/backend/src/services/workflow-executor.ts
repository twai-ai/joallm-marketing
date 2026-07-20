/**
 * Durable workflow execution engine.
 *
 * Supports node types: input, output, llm, rag, conditional, transform,
 * media_ingest, transcribe, media_insights, clip, artifact_out.
 *
 * Independent nodes at the same topological depth execute in parallel via
 * Promise.all(). Async media nodes (transcribe, media_insights) emit a
 * SuspensionSentinel — the engine serialises a lightweight checkpoint and
 * returns status='suspended'. The queue worker calls resumeFromCheckpoint()
 * when the async job completes, restoring execution from where it paused.
 */

import { logger } from '../utils/logger.js';
import { inferenceLineageRepository } from '../repositories/inference-lineage-repository.js';
import { ragService } from './rag-service.js';
import { llmService } from './llm-providers.js';
import { db } from '../database/connection.js';
import { files, transcriptSegments, mediaInsights } from '../database/schema.js';
import { eq } from 'drizzle-orm';
import { mediaProcessingQueue } from './queue.js';

// ── Shared node/edge types ────────────────────────────────────────────────────

export interface WorkflowNode {
  id: string;
  type: string;
  data: Record<string, any>;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
}

// ── Execution log ─────────────────────────────────────────────────────────────

export interface ExecutionLog {
  timestamp: string;
  nodeId: string;
  status: 'running' | 'suspended' | 'completed' | 'failed';
  message: string;
  attempt: number;
  output?: any;
}

// ── Suspension / checkpoint types ─────────────────────────────────────────────

/**
 * Returned by executeNode() when the node has dispatched an async job and the
 * DAG must pause. The executor detects __suspend and serialises a checkpoint.
 */
export interface SuspensionSentinel {
  __suspend: true;
  waitFor: {
    nodeId: string;
    jobType: 'extract_audio' | 'extract_frames';
    externalJobId: string;
    fileId: string;
  };
}

/**
 * Lightweight DAG state serialised to DB on suspension.
 * Stores structural data and primitive/reference values only — no large blobs.
 */
export interface WorkflowCheckpoint {
  /** Snapshot of context at suspension: primitives, UUIDs, and __ref pointers */
  contextRefs: Record<string, any>;
  /** IDs of nodes that had fully completed before suspension */
  completedNodeIds: string[];
  /** Remaining predecessor counts for nodes not yet ready */
  pendingIncoming: Record<string, number>;
  /** IDs of nodes still enabled (not suppressed by a conditional branch) */
  enabledNodeIds: string[];
}

// ── Execution result ──────────────────────────────────────────────────────────

export interface WorkflowExecutionResult {
  status: 'completed' | 'failed' | 'cancelled' | 'suspended';
  output: Record<string, any>;
  executionLog: ExecutionLog[];
  /** Only present when status === 'suspended' */
  checkpoint?: WorkflowCheckpoint;
  /** Only present when status === 'suspended' */
  resumeTrigger?: SuspensionSentinel['waitFor'];
}

export interface WorkflowExecutionContext {
  executionId?: string;
  workflowId?: string;
  userId?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Serialise a context value to a checkpoint-safe form.
 * Primitives pass through. Objects that carry a fileId are stored as a __ref
 * pointer so the checkpoint stays lightweight. Large strings are truncated.
 */
function toCheckpointValue(val: any): any {
  if (val === null || val === undefined) return null;
  if (typeof val !== 'object') {
    // Cap large strings to keep the checkpoint row small
    if (typeof val === 'string' && val.length > 500) {
      return { __truncated: true, preview: val.slice(0, 500) };
    }
    return val;
  }
  // Arrays: map each element
  if (Array.isArray(val)) return val.map(toCheckpointValue);
  // Objects with a fileId: store as a reference
  if (typeof val.fileId === 'string') {
    return { __ref: 'file', fileId: val.fileId };
  }
  // Generic object: recurse but truncate large string leaves
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(val)) {
    out[k] = toCheckpointValue(v);
  }
  return out;
}

function buildContextRefs(context: Record<string, any>): Record<string, any> {
  const refs: Record<string, any> = {};
  for (const [k, v] of Object.entries(context)) {
    refs[k] = toCheckpointValue(v);
  }
  return refs;
}

// ── Core executor ─────────────────────────────────────────────────────────────

export class WorkflowExecutor {
  // ── Public entry points ───────────────────────────────────────────────────

  async execute(
    nodes: WorkflowNode[],
    edges: WorkflowEdge[],
    input: Record<string, any>,
    userApiKeys?: Record<string, string>,
    shouldCancel?: () => Promise<boolean>,
    executionContext?: WorkflowExecutionContext
  ): Promise<WorkflowExecutionResult> {
    const { nodeMap, outgoing, edgesByHandle, incomingCount } = this._buildGraph(nodes, edges);

    const enabled = new Set<string>(nodes.map(n => n.id));
    const pendingIncoming = new Map<string, number>(incomingCount);
    const ready = nodes.filter(n => (pendingIncoming.get(n.id) ?? 0) === 0).map(n => n.id);
    const context: Record<string, any> = { ...input };
    const completed = new Set<string>();
    const log: ExecutionLog[] = [];

    return this._runLoop(
      ready, context, completed, pendingIncoming, enabled,
      nodeMap, outgoing, edgesByHandle, log,
      userApiKeys, shouldCancel, executionContext
    );
  }

  /**
   * Restore a suspended execution from its checkpoint and continue the DAG.
   * Called by the queue worker after an async BullMQ job completes.
   *
   * @param checkpoint  Saved structural state from the suspension point
   * @param injectedContext  Outputs produced by the completed async job
   */
  async resumeFromCheckpoint(
    checkpoint: WorkflowCheckpoint,
    injectedContext: Record<string, any>,
    nodes: WorkflowNode[],
    edges: WorkflowEdge[],
    resumeNodeId?: string,
    userApiKeys?: Record<string, string>,
    shouldCancel?: () => Promise<boolean>,
    executionContext?: WorkflowExecutionContext
  ): Promise<WorkflowExecutionResult> {
    const { nodeMap, outgoing, edgesByHandle } = this._buildGraph(nodes, edges);

    // Restore mutable state from checkpoint
    const context: Record<string, any> = { ...checkpoint.contextRefs, ...injectedContext };
    const completed = new Set<string>(checkpoint.completedNodeIds);
    const pendingIncoming = new Map<string, number>(
      Object.entries(checkpoint.pendingIncoming)
    );
    const enabled = new Set<string>(checkpoint.enabledNodeIds);
    const log: ExecutionLog[] = [];

    if (resumeNodeId) {
      completed.add(resumeNodeId);
      context[resumeNodeId] = { result: injectedContext, ...injectedContext };

      for (const nextId of outgoing.get(resumeNodeId) ?? []) {
        if (!enabled.has(nextId) || completed.has(nextId)) continue;
        const remaining = Math.max(0, (pendingIncoming.get(nextId) ?? 1) - 1);
        pendingIncoming.set(nextId, remaining);
      }

      log.push({
        timestamp: new Date().toISOString(),
        nodeId: resumeNodeId,
        status: 'completed',
        message: 'Async media job completed, resuming workflow',
        attempt: 1,
        output: injectedContext,
      });
    }

    // Re-discover nodes that are now unblocked (pendingIncoming === 0, not completed, enabled)
    const ready: string[] = [];
    for (const [nodeId, remaining] of pendingIncoming) {
      if (!completed.has(nodeId) && enabled.has(nodeId) && remaining === 0) {
        ready.push(nodeId);
      }
    }

    return this._runLoop(
      ready, context, completed, pendingIncoming, enabled,
      nodeMap, outgoing, edgesByHandle, log,
      userApiKeys, shouldCancel, executionContext
    );
  }

  // ── Private graph builder ─────────────────────────────────────────────────

  private _buildGraph(nodes: WorkflowNode[], edges: WorkflowEdge[]) {
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const outgoing = new Map<string, string[]>();
    const edgesByHandle = new Map<string, string>();
    const incomingCount = new Map<string, number>();

    nodes.forEach(n => { outgoing.set(n.id, []); incomingCount.set(n.id, 0); });
    edges.forEach(e => {
      outgoing.get(e.source)?.push(e.target);
      if (e.sourceHandle) {
        edgesByHandle.set(`${e.source}:${e.sourceHandle}`, e.target);
      }
      incomingCount.set(e.target, (incomingCount.get(e.target) ?? 0) + 1);
    });

    return { nodeMap, outgoing, edgesByHandle, incomingCount };
  }

  // ── Private execution loop (shared by execute and resumeFromCheckpoint) ───

  private async _runLoop(
    initialReady: string[],
    context: Record<string, any>,
    completed: Set<string>,
    pendingIncoming: Map<string, number>,
    enabled: Set<string>,
    nodeMap: Map<string, WorkflowNode>,
    outgoing: Map<string, string[]>,
    edgesByHandle: Map<string, string>,
    log: ExecutionLog[],
    userApiKeys?: Record<string, string>,
    shouldCancel?: () => Promise<boolean>,
    executionContext?: WorkflowExecutionContext
  ): Promise<WorkflowExecutionResult> {
    let ready = initialReady;
    let finalOutput: Record<string, any> = {};

    while (ready.length > 0) {
      if (shouldCancel && await shouldCancel()) {
        log.push({
          timestamp: new Date().toISOString(),
          nodeId: 'workflow',
          status: 'failed',
          message: 'Workflow execution cancelled',
          attempt: 1,
        });
        return { status: 'cancelled', output: finalOutput, executionLog: log };
      }

      // Execute all ready nodes in parallel
      type NodeResult = {
        nodeId: string;
        node: WorkflowNode;
        output: Record<string, any> | null;
        error: string | null;
        suspension: SuspensionSentinel | null;
      };

      const results: NodeResult[] = await Promise.all(
        ready.map(async (nodeId): Promise<NodeResult> => {
          const node = nodeMap.get(nodeId)!;

          if (shouldCancel && await shouldCancel()) {
            return { nodeId, node, output: null, error: 'cancelled', suspension: null };
          }

          log.push({
            timestamp: new Date().toISOString(),
            nodeId,
            status: 'running',
            message: `Executing node: ${node.type}`,
            attempt: 1,
          });

          try {
            const raw = await this._executeNode(node, context, userApiKeys, executionContext);

            // Detect suspension sentinel
            if (raw && (raw as any).__suspend === true) {
              const sentinel = raw as unknown as SuspensionSentinel;
              log.push({
                timestamp: new Date().toISOString(),
                nodeId,
                status: 'suspended',
                message: `Node suspended — waiting for ${sentinel.waitFor.jobType} (job ${sentinel.waitFor.externalJobId})`,
                attempt: 1,
              });
              return { nodeId, node, output: null, error: null, suspension: sentinel };
            }

            log.push({
              timestamp: new Date().toISOString(),
              nodeId,
              status: 'completed',
              message: 'Node completed',
              attempt: 1,
              output: raw,
            });
            return { nodeId, node, output: raw, error: null, suspension: null };

          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            log.push({
              timestamp: new Date().toISOString(),
              nodeId,
              status: 'failed',
              message,
              attempt: 1,
            });
            return { nodeId, node, output: null, error: message, suspension: null };
          }
        })
      );

      // Process results
      for (const { nodeId, node, output, error, suspension } of results) {
        // Cancellation
        if (error === 'cancelled') {
          log.push({
            timestamp: new Date().toISOString(),
            nodeId,
            status: 'failed',
            message: 'Workflow execution cancelled',
            attempt: 1,
          });
          return { status: 'cancelled', output: finalOutput, executionLog: log };
        }

        // Node failure — abort entire workflow
        if (error !== null) {
          logger.error(`Workflow node ${nodeId} failed:`, error);
          return { status: 'failed', output: { error }, executionLog: log };
        }

        // Suspension — serialise checkpoint and exit
        if (suspension !== null) {
          const checkpoint: WorkflowCheckpoint = {
            contextRefs: buildContextRefs(context),
            completedNodeIds: [...completed],
            pendingIncoming: Object.fromEntries(pendingIncoming),
            enabledNodeIds: [...enabled],
          };
          return {
            status: 'suspended',
            output: finalOutput,
            executionLog: log,
            checkpoint,
            resumeTrigger: suspension.waitFor,
          };
        }

        // Normal completion
        context[nodeId] = output!;
        finalOutput = { ...finalOutput, ...output! };
        completed.add(nodeId);

        // Conditional branch suppression
        if (node.type === 'conditional') {
          const passed = output!.passed;
          const suppressedBranch = passed ? 'falsePath' : 'truePath';
          const suppressedId = edgesByHandle.get(`${nodeId}:${suppressedBranch}`);
          if (suppressedId) enabled.delete(suppressedId);
        }
      }

      // Advance: decrement pendingIncoming for successors, collect newly-ready nodes
      const nextReady: string[] = [];
      for (const { nodeId, node, output, suspension } of results) {
        if (output === null && suspension === null) continue; // failed — already returned

        const successors: string[] = [];
        if (node.type === 'conditional' && output !== null) {
          const branch = output.passed ? 'truePath' : 'falsePath';
          const nextId = edgesByHandle.get(`${nodeId}:${branch}`);
          if (nextId) successors.push(nextId);
        } else if (suspension === null) {
          // Suspended node does not advance its successors — they wait for resume
          successors.push(...(outgoing.get(nodeId) ?? []));
        }

        for (const nextId of successors) {
          if (!enabled.has(nextId) || completed.has(nextId)) continue;
          const remaining = (pendingIncoming.get(nextId) ?? 1) - 1;
          pendingIncoming.set(nextId, remaining);
          if (remaining === 0) nextReady.push(nextId);
        }
      }

      ready = nextReady;
    }

    return { status: 'completed', output: finalOutput, executionLog: log };
  }

  // ── Node handlers ─────────────────────────────────────────────────────────

  private async _executeNode(
    node: WorkflowNode,
    context: Record<string, any>,
    userApiKeys?: Record<string, string>,
    executionContext?: WorkflowExecutionContext
  ): Promise<Record<string, any>> {
    const data = node.data ?? {};

    switch (node.type) {
      case 'input':
        return {
          result:
            context.input ??
            data.seedContent ??
            data.defaultValue ??
            context,
        };

      case 'output':
        return { result: this._resolveContextValue(data.sourceNodeId ?? '', context) ?? context };

      case 'llm': {
        const prompt = this._interpolate(data.prompt ?? '', context);
        const model = data.model ?? 'claude-haiku-4-5-20251001';
        const startedAt = Date.now();
        try {
          const result = await llmService.generateResponse(
            [{ role: 'user', content: prompt }],
            model,
            { maxTokens: data.maxTokens ?? 1024, temperature: data.temperature ?? 0.7, topP: 1, frequencyPenalty: 0, presencePenalty: 0 },
            userApiKeys && Object.keys(userApiKeys).length > 0 ? userApiKeys : undefined
          );
          await inferenceLineageRepository.recordWorkflowLlmSuccess({
            userId: executionContext?.userId,
            workflowId: executionContext?.workflowId,
            executionId: executionContext?.executionId,
            nodeId: node.id,
            nodeType: node.type,
            model: result.model || model,
            prompt,
            response: result.content,
            startedAt,
            promptTokens: result.usage.promptTokens,
            completionTokens: result.usage.completionTokens,
            totalTokens: result.usage.totalTokens,
          });
          return { result: result.content };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          await inferenceLineageRepository.recordWorkflowLlmFailure({
            userId: executionContext?.userId,
            workflowId: executionContext?.workflowId,
            executionId: executionContext?.executionId,
            nodeId: node.id,
            nodeType: node.type,
            model,
            prompt,
            errorMessage,
            startedAt,
          });
          throw error;
        }
      }

      case 'rag': {
        const query = this._interpolate(data.query ?? '', context);
        const results = await ragService.search({
          query,
          fileIds: data.fileIds ?? [],
          limit: data.limit ?? 5,
          threshold: data.threshold ?? 0.1,
          includeMetadata: true,
        });
        const context_text = results.map(r => r.content).join('\n\n');
        return { result: context_text, results };
      }

      case 'conditional': {
        const value = this._interpolate(data.value ?? '', context);
        const compareTo = this._interpolate(data.compareTo ?? '', context);
        const operator = data.operator ?? 'equals';
        let passed = false;
        if (operator === 'equals') passed = value === compareTo;
        else if (operator === 'contains') passed = value.includes(compareTo);
        else if (operator === 'not_equals') passed = value !== compareTo;
        else if (operator === 'greater_than') passed = parseFloat(value) > parseFloat(compareTo);
        else if (operator === 'less_than') passed = parseFloat(value) < parseFloat(compareTo);
        return { result: passed, passed };
      }

      case 'transform': {
        const input = this._interpolate(data.template ?? '{{result}}', context);
        const transformType = data.transformType ?? 'text';
        let result = input;
        if (transformType === 'uppercase') result = input.toUpperCase();
        else if (transformType === 'lowercase') result = input.toLowerCase();
        else if (transformType === 'trim') result = input.trim();
        else if (transformType === 'json_parse') {
          try { result = JSON.parse(input); } catch { result = input; }
        }
        return { result };
      }

      // ── Media Lab node types ──────────────────────────────────────────────

      case 'media_ingest': {
        const fileId = data.fileId ?? this._interpolate(data.fileIdTemplate ?? '', context);
        if (!fileId) throw new Error('media_ingest: no fileId provided');
        const [file] = await db.select().from(files).where(eq(files.id, fileId)).limit(1);
        if (!file) throw new Error(`media_ingest: file not found: ${fileId}`);
        return {
          result: { fileId: file.id, filename: file.filename, mimetype: file.mimetype, metadata: file.metadata },
          fileId: file.id,
          mediaMetadata: file.metadata,
        };
      }

      case 'transcribe': {
        const fileId = data.fileId ?? context.fileId ?? this._interpolate(data.fileIdTemplate ?? '', context);
        if (!fileId) throw new Error('transcribe: no fileId in context or node data');

        // Enqueue with a deterministic jobId for deduplication
        const externalJobId = `resume-${executionContext?.executionId ?? 'anon'}-${node.id}-extract_audio`;
        if (mediaProcessingQueue) {
          await mediaProcessingQueue.add('extract-audio' as any, {
            fileId,
            userId: executionContext?.userId ?? '',
            jobType: 'extract_audio',
            // Resume metadata embedded in the job — worker uses this directly
            resumeExecutionId: executionContext?.executionId,
            resumeNodeId: node.id,
          }, { jobId: externalJobId });
        }

        // Return a suspension sentinel — DAG pauses here
        return {
          __suspend: true,
          waitFor: {
            nodeId: node.id,
            jobType: 'extract_audio',
            externalJobId,
            fileId,
          },
        } as any;
      }

      case 'media_insights': {
        const fileId = data.fileId ?? context.fileId ?? this._interpolate(data.fileIdTemplate ?? '', context);
        if (!fileId) throw new Error('media_insights: no fileId in context or node data');

        const externalJobId = `resume-${executionContext?.executionId ?? 'anon'}-${node.id}-extract_frames`;
        if (mediaProcessingQueue) {
          await mediaProcessingQueue.add('extract-frames' as any, {
            fileId,
            userId: executionContext?.userId ?? '',
            jobType: 'extract_frames',
            insightModel: data.model,
            intelligenceMode: data.intelligenceMode,
            resumeExecutionId: executionContext?.executionId,
            resumeNodeId: node.id,
          }, { jobId: externalJobId });
        }

        return {
          __suspend: true,
          waitFor: {
            nodeId: node.id,
            jobType: 'extract_frames',
            externalJobId,
            fileId,
          },
        } as any;
      }

      case 'clip': {
        const fileId = data.fileId ?? context.fileId;
        const startTime = data.startTime ?? 0;
        const endTime = data.endTime;
        if (!endTime) throw new Error('clip: endTime is required');
        return { result: { fileId, startTime, endTime }, fileId, startTime, endTime, clipPending: true };
      }

      case 'artifact_out': {
        const fileId = data.fileId ?? context.fileId;
        if (!fileId) return { result: 'artifact_out: no fileId, skipping' };

        const segments = await db
          .select()
          .from(transcriptSegments)
          .where(eq(transcriptSegments.fileId, fileId))
          .orderBy(transcriptSegments.sequenceIndex);

        const insights = await db
          .select()
          .from(mediaInsights)
          .where(eq(mediaInsights.fileId, fileId));

        return {
          result: {
            fileId,
            transcriptSegments: segments.length,
            insights: insights.length,
            indexed: true,
          },
        };
      }

      default:
        logger.warn(`Unknown workflow node type: ${node.type}`);
        return { result: null };
    }
  }

  /** Replace {{key}} placeholders with values from context */
  private _interpolate(template: string, context: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      const val = this._resolveContextValue(key, context);
      if (val === undefined || val === null) return '';
      return typeof val === 'object' ? JSON.stringify(val) : String(val);
    });
  }

  private _resolveContextValue(key: string, context: Record<string, any>): any {
    const val = context[key];
    if (
      val &&
      typeof val === 'object' &&
      'result' in val &&
      Object.keys(val).length === 1
    ) {
      return (val as Record<string, any>).result;
    }
    return val;
  }
}

export const workflowExecutor = new WorkflowExecutor();
