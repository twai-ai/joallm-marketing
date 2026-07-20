import { useState, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ragApiService, HybridSearchOptions, QueryEnhancementOptions, ContextOptimizationOptions, RAGAnalyticsOptions } from '../services/ragApi';
import { showError, showSuccess } from '../utils/toast';

// Enhanced RAG hooks for advanced functionality
export function useHybridSearch() {
  const searchMutation = useMutation({
    mutationFn: async (options: HybridSearchOptions) => {
      return await ragApiService.hybridSearch(options);
    },
    onError: (error) => {
      console.error('Hybrid search failed:', error);
      showError('Hybrid search failed. Please try again.');
    },
  });

  const search = useCallback(async (options: HybridSearchOptions) => {
    return searchMutation.mutateAsync(options);
  }, [searchMutation]);

  return {
    search,
    searchResults: searchMutation.data,
    isSearching: searchMutation.isPending,
    error: searchMutation.error,
  };
}

export function useQueryEnhancement() {
  const enhanceMutation = useMutation({
    mutationFn: async (options: QueryEnhancementOptions) => {
      return await ragApiService.enhanceQuery(options);
    },
    onError: (error) => {
      console.error('Query enhancement failed:', error);
      showError('Query enhancement failed. Please try again.');
    },
  });

  const enhanceQuery = useCallback(async (options: QueryEnhancementOptions) => {
    return enhanceMutation.mutateAsync(options);
  }, [enhanceMutation]);

  return {
    enhanceQuery,
    enhancementResult: enhanceMutation.data,
    isEnhancing: enhanceMutation.isPending,
    error: enhanceMutation.error,
  };
}

export function useContextOptimization() {
  const optimizeMutation = useMutation({
    mutationFn: async (options: ContextOptimizationOptions) => {
      return await ragApiService.optimizeContext(options);
    },
    onError: (error) => {
      console.error('Context optimization failed:', error);
      showError('Context optimization failed. Please try again.');
    },
  });

  const optimizeContext = useCallback(async (options: ContextOptimizationOptions) => {
    return optimizeMutation.mutateAsync(options);
  }, [optimizeMutation]);

  return {
    optimizeContext,
    optimizationResult: optimizeMutation.data,
    isOptimizing: optimizeMutation.isPending,
    error: optimizeMutation.error,
  };
}

export function useRAGAnalytics(options: RAGAnalyticsOptions = {}) {
  const queryClient = useQueryClient();

  const {
    data: analytics,
    isLoading,
    error,
    refetch,
    isFetching,
    isRefetching
  } = useQuery({
    queryKey: ['rag-analytics', options],
    queryFn: () => ragApiService.getAnalytics(options),
    staleTime: 2 * 60 * 1000, // 2 minutes - reduced for more real-time data
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes - more frequent
    refetchIntervalInBackground: true, // Continue refetching when tab is not active
    retry: 3, // Retry failed requests
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
  });

  const refreshAnalytics = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['rag-analytics'] });
  }, [queryClient]);

  const forceRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  return {
    analytics,
    isLoading,
    error,
    refetch,
    refreshAnalytics,
    forceRefresh,
    isFetching,
    isRefetching,
    lastUpdated: analytics ? new Date().toISOString() : null,
  };
}

export function useRAGStats() {
  const {
    data: stats,
    isLoading,
    error,
    refetch,
    isFetching,
    isRefetching
  } = useQuery({
    queryKey: ['rag-stats'],
    queryFn: () => ragApiService.getStats(),
    staleTime: 1 * 60 * 1000, // 1 minute - stats change more frequently
    refetchInterval: 3 * 60 * 1000, // Refetch every 3 minutes
    refetchIntervalInBackground: true,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  const forceRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  return {
    stats,
    isLoading,
    error,
    refetch,
    forceRefresh,
    isFetching,
    isRefetching,
    lastUpdated: stats ? new Date().toISOString() : null,
  };
}

export function useDocumentChunks(fileId: string, page: number = 1, limit: number = 20) {
  const {
    data: chunksData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['document-chunks', fileId, page, limit],
    queryFn: () => ragApiService.getDocumentChunks(fileId, page, limit),
    enabled: !!fileId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    chunks: chunksData?.chunks || [],
    pagination: chunksData?.pagination,
    isLoading,
    error,
    refetch,
  };
}

export function useDocumentReindex() {
  const reindexMutation = useMutation({
    mutationFn: async (fileId: string) => {
      return await ragApiService.reindexDocument(fileId);
    },
    onSuccess: () => {
      showSuccess('Document reindexing started successfully');
    },
    onError: (error) => {
      console.error('Document reindexing failed:', error);
      showError('Document reindexing failed. Please try again.');
    },
  });

  const reindexDocument = useCallback(async (fileId: string) => {
    return reindexMutation.mutateAsync(fileId);
  }, [reindexMutation]);

  return {
    reindexDocument,
    isReindexing: reindexMutation.isPending,
    error: reindexMutation.error,
  };
}

// Combined hook for all advanced RAG functionality
export function useAdvancedRAG() {
  const hybridSearch = useHybridSearch();
  const queryEnhancement = useQueryEnhancement();
  const contextOptimization = useContextOptimization();
  const analytics = useRAGAnalytics();
  const stats = useRAGStats();
  const documentReindex = useDocumentReindex();

  return {
    // Search functionality
    hybridSearch,
    queryEnhancement,
    contextOptimization,
    
    // Analytics and monitoring
    analytics,
    stats,
    
    // Document management
    documentReindex,
    
    // Combined loading state
    isLoading: hybridSearch.isSearching || 
               queryEnhancement.isEnhancing || 
               contextOptimization.isOptimizing ||
               analytics.isLoading ||
               stats.isLoading,
    
    // Real-time data indicators
    isRefreshing: analytics.isRefetching || stats.isRefetching,
    lastDataUpdate: analytics.lastUpdated || stats.lastUpdated,
  };
}
