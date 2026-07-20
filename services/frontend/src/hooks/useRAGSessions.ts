import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRAGSessionStore, RAGSearchSession, RAGSearchQuery } from '../stores/ragSessionStore';
import { ragSessionApiService, CreateRAGSessionRequest } from '../services/ragSessionApi';
import { showSuccess, showError } from '../utils/toast';

export function useRAGSessions() {
  const queryClient = useQueryClient();
  
  const {
    sessions,
    activeSessionId,
    queries,
    setSessions,
    addSession,
    updateSession,
    deleteSession,
    setActiveSession,
    setQueries,
    addQuery,
    setLoading,
    clearQueries,
  } = useRAGSessionStore();

  // Fetch RAG search sessions
  const { data: fetchedSessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ['rag-search-sessions'],
    queryFn: async () => {
      const response = await ragSessionApiService.getSessions(1, 50);
      setSessions(response.sessions);
      return response.sessions;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // Fetch queries for active session
  const { data: sessionQueries, isLoading: queriesLoading } = useQuery({
    queryKey: ['rag-session-queries', activeSessionId],
    queryFn: async () => {
      if (!activeSessionId) return [];
      try {
        const response = await ragSessionApiService.getSessionQueries(activeSessionId, 1, 100);
        setQueries(response.queries);
        return response.queries;
      } catch (error: any) {
        if (error?.status === 404 || error?.response?.status === 404) {
          // Only log in development
          if (import.meta.env.DEV) {
            console.warn(`RAG session ${activeSessionId} not found, clearing from storage`);
          }
          setActiveSession(null);
        }
        throw error;
      }
    },
    enabled: !!activeSessionId,
    staleTime: 5 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: false,
  });

  // Create new RAG session
  const createSessionMutation = useMutation({
    mutationFn: async (data: CreateRAGSessionRequest) => {
      const session = await ragSessionApiService.createSession(data);
      addSession(session);
      return session;
    },
    onSuccess: (session) => {
      showSuccess('RAG search session created successfully');
      queryClient.invalidateQueries({ queryKey: ['rag-search-sessions'] });
    },
    onError: (error: any) => {
      console.error('Failed to create RAG session:', error);
      showError('Failed to create RAG search session');
    },
  });

  // Delete RAG session
  const deleteSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      await ragSessionApiService.deleteSession(sessionId);
      deleteSession(sessionId);
    },
    onSuccess: () => {
      showSuccess('RAG search session deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['rag-search-sessions'] });
    },
    onError: (error: any) => {
      console.error('Failed to delete RAG session:', error);
      showError('Failed to delete RAG search session');
    },
  });

  // Update RAG session
  const updateSessionMutation = useMutation({
    mutationFn: async ({ sessionId, updates }: { sessionId: string; updates: Partial<CreateRAGSessionRequest> }) => {
      const session = await ragSessionApiService.updateSession(sessionId, updates);
      updateSession(sessionId, session);
      return session;
    },
    onSuccess: () => {
      showSuccess('RAG search session updated successfully');
      queryClient.invalidateQueries({ queryKey: ['rag-search-sessions'] });
    },
    onError: (error: any) => {
      console.error('Failed to update RAG session:', error);
      showError('Failed to update RAG search session');
    },
  });

  // Actions
  const createSession = useCallback(async (data: CreateRAGSessionRequest) => {
    return createSessionMutation.mutateAsync(data);
  }, [createSessionMutation]);

  const removeSession = useCallback(async (sessionId: string) => {
    return deleteSessionMutation.mutateAsync(sessionId);
  }, [deleteSessionMutation]);

  const modifySession = useCallback(async (sessionId: string, updates: Partial<CreateRAGSessionRequest>) => {
    return updateSessionMutation.mutateAsync({ sessionId, updates });
  }, [updateSessionMutation]);

  const selectSession = useCallback((sessionId: string | null) => {
    setActiveSession(sessionId);
    if (sessionId) {
      clearQueries();
    }
  }, [setActiveSession, clearQueries]);

  const refreshSessions = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['rag-search-sessions'] });
  }, [queryClient]);

  const refreshQueries = useCallback(() => {
    if (activeSessionId) {
      queryClient.invalidateQueries({ queryKey: ['rag-session-queries', activeSessionId] });
    }
  }, [queryClient, activeSessionId]);

  // Get active session
  const activeSession = sessions.find(s => s.id === activeSessionId);

  return {
    // State
    sessions,
    activeSession,
    activeSessionId,
    queries,
    isLoading: sessionsLoading || queriesLoading,
    
    // Actions
    createSession,
    deleteSession: removeSession,
    updateSession: modifySession,
    setActiveSession: selectSession,
    refreshSessions,
    refreshQueries,
    
    // Mutations
    createSessionMutation,
    deleteSessionMutation,
    updateSessionMutation,
  };
}
