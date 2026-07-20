import { enhancedRAGService } from '../../services/enhanced-rag-service.js';
import { llmService } from '../../services/llm-providers.js';
import { formatContext, getMode } from '../../services/rag-modes.js';
import { logger } from '../../utils/logger.js';
import { ragChatAccessRepository } from '../../repositories/rag-chat-access-repository.js';
import { ragLineageRepository } from '../../repositories/rag-lineage-repository.js';
import { userApiKeyRepository } from '../../repositories/user-api-key-repository.js';

type ConfidenceLevel = 'none' | 'low' | 'medium' | 'high';

type RAGChatParams = {
  message: string;
  conversationId?: string;
  documentIds?: string[];
  maxTokens?: number;
  model?: string;
  mode?: string;
  userId?: string;
};

type RAGChatSource = {
  id: string;
  filename: string;
  content: string;
  score: number;
  chunkIndex: number;
};

export type RAGChatResult = {
  response: string;
  sources: RAGChatSource[];
  confidence: ConfidenceLevel;
  mode: string;
  conversationId: string;
  timestamp: string;
};

export class RAGChatError extends Error {
  constructor(message: string, readonly statusCode: number) {
    super(message);
    this.name = 'RAGChatError';
  }
}

type SearchResult = {
  id: string;
  content: string;
  score: number;
  metadata?: {
    filename?: string;
    chunkIndex?: number;
  } | null;
  file?: {
    filename?: string;
  } | null;
};

async function assertAccessibleDocuments(documentIds: string[] | undefined, userId?: string) {
  if (!documentIds || documentIds.length === 0) {
    return;
  }

  if (!userId) {
    throw new RAGChatError('Authentication required to filter by documents', 401);
  }

  const ownedDocumentIds = await ragChatAccessRepository.getAccessibleDocumentIds(documentIds, userId);

  if (ownedDocumentIds.length !== documentIds.length) {
    throw new RAGChatError('One or more documents not found or not accessible', 403);
  }
}

function buildFallbackResponse(searchResults: SearchResult[]) {
  const topResult = searchResults[0];
  const file = topResult.file || {};
  const filename = file.filename || topResult.metadata?.filename || 'the knowledge base';

  const keyInsights = searchResults
    .slice(0, 3)
    .map((result, index) => {
      const content = result.content.substring(0, 250).trim();
      return `${index + 1}. ${content}${result.content.length > 250 ? '...' : ''}`;
    })
    .join('\n\n');

  return `Based on ${filename} and related documentation, here's what I found:\n\n${keyInsights}\n\n${
    searchResults.length > 3 ? `Additional information is available from ${searchResults.length - 3} more sources. ` : ''
  }Would you like me to elaborate on any specific aspect?`;
}

function mapSources(searchResults: SearchResult[]): RAGChatSource[] {
  return searchResults.map((result) => ({
    id: result.id,
    filename: result.file?.filename || result.metadata?.filename || 'Unknown',
    content: result.content,
    score: result.score,
    chunkIndex: result.metadata?.chunkIndex || 0,
  }));
}

export async function runRagChat({
  message,
  conversationId,
  documentIds,
  maxTokens = 1000,
  model = 'llama-3.1-8b-instant',
  mode,
  userId,
}: RAGChatParams): Promise<RAGChatResult> {
  const modeConfig = getMode(mode);
  const startedAt = Date.now();
  const resolvedConversationId = conversationId || `conv_${Date.now()}`;
  await assertAccessibleDocuments(documentIds, userId);

  const userApiKeys = userId ? await userApiKeyRepository.getDecryptedApiKeys(userId) : {};

  try {
    const confidenceResult = await enhancedRAGService.searchWithConfidence({
      query: message,
      fileIds: documentIds || [],
      limit: modeConfig.limit,
      threshold: modeConfig.threshold,
      includeMetadata: true,
      searchType: 'hybrid',
      vectorWeight: modeConfig.vectorWeight,
      keywordWeight: modeConfig.keywordWeight,
    });

    logger.info(`RAG chat [${modeConfig.id}] confidence: ${confidenceResult.confidence}, results: ${confidenceResult.results.length}`);

    if (!confidenceResult.hasRelevantResults) {
      const result = {
        response:
          "I couldn't find relevant information in the knowledge base to answer your question.\n\nPlease try:\n• Rephrasing your question with different keywords\n• Checking if the relevant documents are uploaded and processed\n• Browsing the document list to see what's available in the knowledge base",
        sources: [],
        confidence: 'none' as ConfidenceLevel,
        mode: modeConfig.id,
        conversationId: resolvedConversationId,
        timestamp: new Date().toISOString(),
      };

      await ragLineageRepository.recordRagChatSuccess({
        userId,
        conversationId: resolvedConversationId,
        message,
        documentIds: documentIds || [],
        maxTokens,
        model,
        mode: modeConfig.id,
        response: result.response,
        confidence: result.confidence,
        sources: [],
        startedAt,
        promptTokens: null,
        completionTokens: null,
        totalTokens: null,
        fallbackUsed: false,
        hasRelevantResults: false,
      });

      return result;
    }

    const searchResults: SearchResult[] = [...confidenceResult.results];

    if (modeConfig.multiHop && modeConfig.secondPassLimit > 0 && searchResults.length > 0) {
      const expansionTerms = searchResults
        .slice(0, 3)
        .map((result) => result.content.substring(0, 200))
        .join(' ');
      const expandedQuery = `${message} ${expansionTerms}`.substring(0, 500);

      try {
        const secondPass = await enhancedRAGService.searchWithConfidence({
          query: expandedQuery,
          fileIds: documentIds || [],
          limit: modeConfig.secondPassLimit,
          threshold: modeConfig.threshold,
          includeMetadata: true,
          searchType: 'hybrid',
          vectorWeight: modeConfig.vectorWeight,
          keywordWeight: modeConfig.keywordWeight,
        });

        const seen = new Set(searchResults.map((result) => result.id));
        for (const result of secondPass.results) {
          if (!seen.has(result.id)) {
            seen.add(result.id);
            searchResults.push(result);
          }
        }

        searchResults.sort((a, b) => b.score - a.score);
        logger.info(`RAG research mode 2nd pass added ${secondPass.results.length} candidates, total: ${searchResults.length}`);
      } catch (hopError) {
        logger.warn('Research mode second pass failed, continuing with first pass results:', hopError);
      }
    }

    const context = formatContext(searchResults);
    const responsePrefix =
      confidenceResult.confidence === 'low' ? '⚠️ Limited Information: Based on limited matches in the knowledge base.\n\n' : '';
    const systemPrompt = modeConfig.buildSystemPrompt(context, confidenceResult.confidence);
    const userPrompt = modeConfig.buildUserPrompt(message);

    let response: string;
    let llmUsage: { promptTokens: number; completionTokens: number; totalTokens: number } | undefined;
    let fallbackUsed = false;

    try {
      const llmResponse = await llmService.generateResponse(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        model,
        {
          temperature: modeConfig.temperature,
          maxTokens: maxTokens || modeConfig.maxTokens,
          topP: 1.0,
          frequencyPenalty: 0.0,
          presencePenalty: 0.0,
        },
        userApiKeys,
      );

      llmUsage = llmResponse.usage;
      response =
        llmResponse.content || 'I apologize, but I was unable to generate a response. Please try rephrasing your question.';
    } catch (llmError) {
      logger.warn('LLM service failed, falling back to structured response:', llmError);
      fallbackUsed = true;
      response = buildFallbackResponse(searchResults);
    }

    const result = {
      response: responsePrefix + response,
      sources: mapSources(searchResults),
      confidence: confidenceResult.confidence,
      mode: modeConfig.id,
      conversationId: resolvedConversationId,
      timestamp: new Date().toISOString(),
    };

    await ragLineageRepository.recordRagChatSuccess({
      userId,
      conversationId: resolvedConversationId,
      message,
      documentIds: documentIds || [],
      maxTokens,
      model,
      mode: modeConfig.id,
      response: result.response,
      confidence: result.confidence,
      sources: searchResults,
      startedAt,
      promptTokens: llmUsage?.promptTokens ?? null,
      completionTokens: llmUsage?.completionTokens ?? null,
      totalTokens: llmUsage?.totalTokens ?? null,
      fallbackUsed,
      hasRelevantResults: true,
    });

    return result;
  } catch (error) {
    await ragLineageRepository.recordRagChatFailure({
      userId,
      conversationId: resolvedConversationId,
      message,
      documentIds: documentIds || [],
      maxTokens,
      model,
      mode: modeConfig.id,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      startedAt,
    });

    throw error;
  }
}
