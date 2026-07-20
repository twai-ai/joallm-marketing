import { apiClient } from '../utils/api-client';
import { API_ENDPOINTS } from '../config/api';

// Types for enhanced RAG functionality
export interface HybridSearchOptions {
  query: string;
  fileIds?: string[];
  limit?: number;
  vectorWeight?: number;
  keywordWeight?: number;
  threshold?: number;
  includeMetadata?: boolean;
}

export interface HybridSearchResult {
  id: string;
  content: string;
  score: number;
  vectorScore: number;
  keywordScore: number;
  metadata: Record<string, any>;
  file: {
    id: string;
    filename: string;
    uploadDate: string;
    size: number;
  };
}

export interface HybridSearchResponse {
  query: string;
  results: HybridSearchResult[];
  totalResults: number;
  searchTime: number;
  searchMethod: string;
}

export interface QueryEnhancementOptions {
  query: string;
  enhancementType?: 'rewrite' | 'expand' | 'classify' | 'all';
  context?: string;
  maxExpansions?: number;
}

export interface QueryClassification {
  type: 'factual' | 'analytical' | 'creative' | 'comparative';
  complexity: 'simple' | 'complex' | 'multi-step';
  domain: 'general' | 'technical' | 'legal' | 'medical';
  requiresContext: boolean;
}

export interface QueryEnhancementResponse {
  originalQuery: string;
  enhancedQuery: string;
  expandedQueries: string[];
  queryClassification: QueryClassification;
  suggestions: string[];
}

export interface ContextOptimizationOptions {
  query: string;
  documentIds: string[];
  maxTokens?: number;
  priorityScoring?: boolean;
  contextCompression?: boolean;
}

export interface OptimizedContext {
  id: string;
  content: string;
  relevanceScore: number;
  tokenCount: number;
  priority: number;
}

export interface ContextOptimizationResponse {
  optimizedContext: OptimizedContext[];
  totalTokens: number;
  compressionRatio: number;
  contextEfficiency: number;
}

export interface RAGAnalytics {
  searchMetrics: {
    totalSearches: number;
    averageResponseTime: number;
    successRate: number;
    topQueries: Array<{
      query: string;
      frequency: number;
      averageScore: number;
    }>;
  };
  documentMetrics: {
    totalDocuments: number;
    totalChunks: number;
    mostAccessedDocuments: Array<{
      id: string;
      name: string;
      accessCount: number;
      lastAccessed: string;
    }>;
    chunkUtilization: number;
    embeddingCoverage: number;
  };
  performanceMetrics: {
    averageRelevanceScore: number;
    contextEfficiency: number;
    searchLatency: number;
    embeddingGenerationTime: number;
  };
}

export interface RAGAnalyticsOptions {
  timeRange?: '1h' | '24h' | '7d' | '30d';
  includeDetails?: boolean;
}

// Enhanced RAG API Service
export class RAGApiService {
  /**
   * Perform hybrid search combining vector and keyword search
   */
  async hybridSearch(options: HybridSearchOptions): Promise<HybridSearchResponse> {
    const response = await apiClient.post<HybridSearchResponse>(
      API_ENDPOINTS.rag.hybridSearch,
      options
    );
    return response;
  }

  /**
   * Enhance query with rewriting and expansion
   */
  async enhanceQuery(options: QueryEnhancementOptions): Promise<QueryEnhancementResponse> {
    const response = await apiClient.post<QueryEnhancementResponse>(
      API_ENDPOINTS.rag.queryEnhance,
      options
    );
    return response;
  }

  /**
   * Optimize context window for given query and documents
   */
  async optimizeContext(options: ContextOptimizationOptions): Promise<ContextOptimizationResponse> {
    const response = await apiClient.post<ContextOptimizationResponse>(
      API_ENDPOINTS.rag.contextOptimize,
      options
    );
    return response;
  }

  /**
   * Get comprehensive RAG analytics dashboard data
   */
  async getAnalytics(options: RAGAnalyticsOptions = {}): Promise<RAGAnalytics> {
    const params = new URLSearchParams();
    if (options.timeRange) params.append('timeRange', options.timeRange);
    if (options.includeDetails) params.append('includeDetails', 'true');

    const url = `${API_ENDPOINTS.rag.analytics}?${params.toString()}`;
    const response = await apiClient.get<RAGAnalytics>(url);
    return response;
  }

  /**
   * Get RAG system statistics
   */
  async getStats() {
    const response = await apiClient.get(API_ENDPOINTS.rag.stats);
    return response;
  }

  /**
   * Get document chunks with pagination
   */
  async getDocumentChunks(fileId: string, page: number = 1, limit: number = 20) {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());

    const url = `${API_ENDPOINTS.rag.chunks(fileId)}?${params.toString()}`;
    const response = await apiClient.get(url);
    return response;
  }

  /**
   * Reindex a document
   */
  async reindexDocument(fileId: string) {
    const response = await apiClient.post(API_ENDPOINTS.rag.reindex(fileId));
    return response;
  }

  /**
   * Perform standard RAG search (existing functionality)
   */
  async search(query: string, options: {
    fileIds?: string[];
    limit?: number;
    threshold?: number;
    includeMetadata?: boolean;
  } = {}) {
    const response = await apiClient.post(API_ENDPOINTS.rag.search, {
      query,
      ...options
    });
    return response;
  }
}

// Export singleton instance
export const ragApiService = new RAGApiService();
