// Custom hook for RAG (Retrieval-Augmented Generation) operations
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '../utils/api-client';
import { API_ENDPOINTS } from '../config/api';
import { showError } from '../utils/toast';
import { mapBackendSearchResultToKnowledgeResult } from '../domain/knowledge';

interface RAGSearchParams {
  query: string;
  topK?: number;
  threshold?: number;
  documentIds?: string[];
  sessionId?: string;
}

interface RAGSearchResult {
  id: string;
  content: string;
  score: number;
  metadata?: {
    fileId: string;
    filename: string;
    chunkIndex: number;
    startChar: number;
    endChar: number;
  };
  file?: {
    id: string;
    filename: string;
    uploadDate: string;
    size: number;
  };
  // Legacy fields for backward compatibility
  documentId?: string;
  documentName?: string;
}

interface RAGSearchResponse {
  query: string;
  results: RAGSearchResult[];
  searchTime: number;
  totalResults: number;
}

export function useRAG() {
  // Semantic search mutation
  const searchMutation = useMutation({
    mutationFn: async (params: RAGSearchParams) => {
      const response = await apiClient.post<RAGSearchResponse>(
        API_ENDPOINTS.rag.search,
        {
          query: params.query,
          topK: params.topK || 5,
          threshold: params.threshold || 0.05, // Lower threshold to catch more results
          documentIds: params.documentIds,
          sessionId: params.sessionId,
        }
      );
      
      return response.results.map(mapBackendSearchResultToKnowledgeResult);
    },
    onError: (error) => {
      // Only log errors in development
      if (import.meta.env.DEV) {
        console.error('RAG Search Error:', error);
      }
      showError('Failed to search knowledge base');
    },
  });

  // Hybrid search mutation
  const hybridSearchMutation = useMutation({
    mutationFn: async (params: RAGSearchParams & {
      vectorWeight?: number;
      keywordWeight?: number;
      includeMetadata?: boolean;
    }) => {
      const response = await apiClient.post<RAGSearchResponse>(
        API_ENDPOINTS.rag.hybridSearch,
        {
          query: params.query,
          limit: params.topK || 5,
          threshold: params.threshold || 0.1,
          vectorWeight: params.vectorWeight || 0.7,
          keywordWeight: params.keywordWeight || 0.3,
          includeMetadata: params.includeMetadata !== false,
          fileIds: params.documentIds,
          sessionId: params.sessionId,
        }
      );
      return response.results.map(mapBackendSearchResultToKnowledgeResult);
    },
    onError: () => {
      showError('Failed to perform hybrid search');
    },
  });

  const search = async (query: string, options?: Partial<RAGSearchParams>) => {
    return searchMutation.mutateAsync({
      query,
      ...options,
    });
  };

  const hybridSearch = async (query: string, options?: Partial<RAGSearchParams & {
    vectorWeight?: number;
    keywordWeight?: number;
    includeMetadata?: boolean;
  }>) => {
    return hybridSearchMutation.mutateAsync({
      query,
      ...options,
    });
  };

  return {
    search,
    hybridSearch,
    searchResults: searchMutation.data || hybridSearchMutation.data,
    isSearching: searchMutation.isPending || hybridSearchMutation.isPending,
  };
}

