import { db } from '../database/connection.js';
import { inferenceRuns } from '../database/schema.js';
import { logger } from '../utils/logger.js';

type WorkflowInferenceStatus = 'succeeded' | 'failed';

type WorkflowLlmLineageBaseParams = {
  userId?: string;
  workflowId?: string;
  executionId?: string;
  nodeId: string;
  nodeType: string;
  model: string;
  prompt: string;
  startedAt: number;
};

type RecordWorkflowLlmSuccessParams = WorkflowLlmLineageBaseParams & {
  response: string;
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
};

type RecordWorkflowLlmFailureParams = WorkflowLlmLineageBaseParams & {
  errorMessage: string;
};

function resolveInferenceProvider(model: string) {
  if (model.startsWith('gpt-') || model.startsWith('o1-')) {
    return 'openai';
  }

  if (model.startsWith('claude-')) {
    return 'anthropic';
  }

  if (
    model.startsWith('ollama/') ||
    model.startsWith('codellama') ||
    model.startsWith('phi') ||
    model.startsWith('neural-chat') ||
    model.startsWith('starling') ||
    model.startsWith('orca') ||
    model.startsWith('vicuna') ||
    model.startsWith('wizardlm') ||
    (model.startsWith('llama') && !model.startsWith('llama-3.1') && !model.startsWith('llama-3.3')) ||
    (model.startsWith('mistral') && !model.startsWith('mixtral'))
  ) {
    return 'ollama';
  }

  if (
    model.startsWith('llama-') ||
    model.startsWith('mixtral') ||
    model.startsWith('gemma') ||
    model.startsWith('meta-llama/') ||
    model.startsWith('openai/') ||
    model.startsWith('groq/') ||
    model.startsWith('moonshotai/') ||
    model.startsWith('qwen/')
  ) {
    return 'groq';
  }

  return 'unknown';
}

function buildWorkflowInput(params: WorkflowLlmLineageBaseParams) {
  return {
    workflowId: params.workflowId ?? null,
    executionId: params.executionId ?? null,
    nodeId: params.nodeId,
    nodeType: params.nodeType,
    model: params.model,
    prompt: params.prompt,
  };
}

function buildWorkflowOutput(params: {
  response?: string;
  errorMessage?: string;
}) {
  return {
    response: params.response,
    errorMessage: params.errorMessage,
  };
}

export class InferenceLineageRepository {
  async recordWorkflowLlmSuccess(params: RecordWorkflowLlmSuccessParams): Promise<void> {
    try {
      await db.insert(inferenceRuns).values({
        organizationId: null,
        workspaceId: null,
        userId: params.userId ?? null,
        provider: resolveInferenceProvider(params.model),
        model: params.model,
        status: 'succeeded' as WorkflowInferenceStatus,
        input: buildWorkflowInput(params),
        output: buildWorkflowOutput({
          response: params.response,
        }),
        promptTokens: params.promptTokens ?? null,
        completionTokens: params.completionTokens ?? null,
        totalTokens: params.totalTokens ?? null,
        latencyMs: Date.now() - params.startedAt,
        startedAt: new Date(params.startedAt),
        completedAt: new Date(),
        metadata: {
          source: 'workflow-llm-node',
          workflowId: params.workflowId ?? null,
          executionId: params.executionId ?? null,
          nodeId: params.nodeId,
          nodeType: params.nodeType,
        },
      });
    } catch (error) {
      logger.warn('Failed to persist workflow LLM success lineage:', error);
    }
  }

  async recordWorkflowLlmFailure(params: RecordWorkflowLlmFailureParams): Promise<void> {
    try {
      await db.insert(inferenceRuns).values({
        organizationId: null,
        workspaceId: null,
        userId: params.userId ?? null,
        provider: resolveInferenceProvider(params.model),
        model: params.model,
        status: 'failed' as WorkflowInferenceStatus,
        input: buildWorkflowInput(params),
        output: buildWorkflowOutput({
          errorMessage: params.errorMessage,
        }),
        errorMessage: params.errorMessage,
        latencyMs: Date.now() - params.startedAt,
        startedAt: new Date(params.startedAt),
        completedAt: new Date(),
        metadata: {
          source: 'workflow-llm-node',
          workflowId: params.workflowId ?? null,
          executionId: params.executionId ?? null,
          nodeId: params.nodeId,
          nodeType: params.nodeType,
          errorMessage: params.errorMessage,
        },
      });
    } catch (error) {
      logger.warn('Failed to persist workflow LLM failure lineage:', error);
    }
  }
}

export const inferenceLineageRepository = new InferenceLineageRepository();
