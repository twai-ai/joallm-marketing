import { db } from '../database/connection.js';
import { inferenceRuns, messageRagSources, messages } from '../database/schema.js';
import { logger } from '../utils/logger.js';

type ConfidenceLevel = 'none' | 'low' | 'medium' | 'high';

export type RagLineageSource = {
  id: string;
  score: number;
};

type RecordRagChatSuccessParams = {
  userId?: string;
  conversationId: string;
  message: string;
  documentIds: string[];
  maxTokens: number;
  model: string;
  mode: string;
  response: string;
  confidence: ConfidenceLevel;
  sources: RagLineageSource[];
  startedAt: number;
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
  fallbackUsed: boolean;
  hasRelevantResults: boolean;
};

type RecordRagChatFailureParams = {
  userId?: string;
  conversationId: string;
  message: string;
  documentIds: string[];
  maxTokens: number;
  model: string;
  mode: string;
  errorMessage: string;
  startedAt: number;
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

function buildInferenceInput(params: {
  message: string;
  conversationId: string;
  documentIds: string[];
  maxTokens: number;
  model: string;
  mode: string;
}) {
  return {
    message: params.message,
    conversationId: params.conversationId,
    documentIds: params.documentIds,
    maxTokens: params.maxTokens,
    model: params.model,
    mode: params.mode,
  };
}

function buildInferenceOutput(params: {
  response?: string;
  confidence?: ConfidenceLevel;
  sourceCount: number;
  sourceIds: string[];
  fallbackUsed?: boolean;
  errorMessage?: string;
}) {
  return {
    response: params.response,
    confidence: params.confidence,
    sourceCount: params.sourceCount,
    sourceIds: params.sourceIds,
    fallbackUsed: params.fallbackUsed,
    errorMessage: params.errorMessage,
  };
}

export class RagLineageRepository {
  async recordRagChatSuccess(params: RecordRagChatSuccessParams): Promise<void> {
    try {
      await db.transaction(async (tx) => {
        const [assistantMessage] = await tx
          .insert(messages)
          .values({
            sessionId: null,
            role: 'assistant',
            content: params.response,
            model: params.model,
            ragMode: params.mode as 'standard' | 'research' | 'compliance' | 'decision' | undefined,
            metadata: {
              source: 'rag-chat',
              conversationId: params.conversationId,
              mode: params.mode,
              confidence: params.confidence,
              documentIds: params.documentIds,
              sourceCount: params.sources.length,
              fallbackUsed: params.fallbackUsed,
              hasRelevantResults: params.hasRelevantResults,
            },
          })
          .returning({ id: messages.id });

        if (params.sources.length > 0) {
          await tx.insert(messageRagSources).values(
            params.sources.map((source, index) => ({
              messageId: assistantMessage.id,
              chunkId: source.id,
              rankPosition: index + 1,
              similarityScore: source.score,
              wasUsed: true,
            })),
          );
        }

        await tx.insert(inferenceRuns).values({
          organizationId: null,
          workspaceId: null,
          userId: params.userId ?? null,
          provider: resolveInferenceProvider(params.model),
          model: params.model,
          status: 'succeeded',
          input: buildInferenceInput({
            message: params.message,
            conversationId: params.conversationId,
            documentIds: params.documentIds,
            maxTokens: params.maxTokens,
            model: params.model,
            mode: params.mode,
          }),
          output: buildInferenceOutput({
            response: params.response,
            confidence: params.confidence,
            sourceCount: params.sources.length,
            sourceIds: params.sources.map((source) => source.id),
            fallbackUsed: params.fallbackUsed,
          }),
          promptTokens: params.promptTokens ?? null,
          completionTokens: params.completionTokens ?? null,
          totalTokens: params.totalTokens ?? null,
          latencyMs: Date.now() - params.startedAt,
          startedAt: new Date(params.startedAt),
          completedAt: new Date(),
          metadata: {
            source: 'rag-chat',
            conversationId: params.conversationId,
            mode: params.mode,
            confidence: params.confidence,
            sourceCount: params.sources.length,
            fallbackUsed: params.fallbackUsed,
            hasRelevantResults: params.hasRelevantResults,
            messageId: assistantMessage.id,
          },
        });
      });
    } catch (error) {
      logger.warn('Failed to persist RAG chat success lineage:', error);
    }
  }

  async recordRagChatFailure(params: RecordRagChatFailureParams): Promise<void> {
    try {
      await db.insert(inferenceRuns).values({
        organizationId: null,
        workspaceId: null,
        userId: params.userId ?? null,
        provider: resolveInferenceProvider(params.model),
        model: params.model,
        status: 'failed',
          input: buildInferenceInput({
            message: params.message,
            conversationId: params.conversationId,
            documentIds: params.documentIds,
            maxTokens: params.maxTokens,
            model: params.model,
            mode: params.mode,
          }),
        output: buildInferenceOutput({
          sourceCount: 0,
          sourceIds: [],
          errorMessage: params.errorMessage,
        }),
        errorMessage: params.errorMessage,
        latencyMs: Date.now() - params.startedAt,
        startedAt: new Date(params.startedAt),
        completedAt: new Date(),
        metadata: {
          source: 'rag-chat',
          conversationId: params.conversationId,
          mode: params.mode,
          errorMessage: params.errorMessage,
        },
      });
    } catch (error) {
      logger.warn('Failed to persist RAG chat failure lineage:', error);
    }
  }
}

export const ragLineageRepository = new RagLineageRepository();
