import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRAGChatStore, RAGChatSession, RAGChatMessage } from '../stores/ragChatStore';
import { ragChatSessionsApiService } from '../services/ragChatSessionsApi';
import { showSuccess, showError } from '../utils/toast';
import { useLLM } from '../contexts/LLMContext';

export function useRAGChatSessions() {
  const queryClient = useQueryClient();
  const { selectedModel } = useLLM();
  
  const {
    sessions,
    activeSessionId,
    messages,
    setSessions,
    addSession,
    updateSession,
    deleteSession,
    setActiveSession,
    setMessages,
    addMessage,
    clearMessages,
    setLoading,
    setStreaming,
    setStreamingMessageId,
  } = useRAGChatStore();

  // Fetch RAG chat sessions
  const { data: fetchedSessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ['rag-sessions'],
    queryFn: async () => {
      const sessions = await ragChatSessionsApiService.getSessions();
      setSessions(sessions);
      return sessions;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // Fetch messages for active session
  const { data: sessionMessages, isLoading: messagesLoading } = useQuery({
    queryKey: ['rag-session-messages', activeSessionId],
    queryFn: async () => {
      if (!activeSessionId) return [];
      try {
        const messages = await ragChatSessionsApiService.getSessionMessages(activeSessionId);
        setMessages(messages);
        return messages;
      } catch (error: any) {
        if (error?.status === 404 || error?.response?.status === 404) {
          console.warn(`RAG session ${activeSessionId} not found, clearing from storage`);
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
    mutationFn: async (title?: string) => {
      return await ragChatSessionsApiService.createSession({
        title: title || 'New RAG Chat',
        model: selectedModel?.id || 'llama-3.1-8b-instant',
      });
    },
    onSuccess: (session) => {
      addSession(session);
      setActiveSession(session.id);
      clearMessages();
      queryClient.invalidateQueries({ queryKey: ['rag-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['rag-session-messages', session.id] });
      showSuccess('New RAG chat session created');
    },
    onError: () => {
      showError('Failed to create RAG chat session');
    },
  });

  // Delete RAG session
  const deleteSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      await ragChatSessionsApiService.deleteSession(sessionId);
    },
    onSuccess: (_, sessionId) => {
      deleteSession(sessionId);
      queryClient.invalidateQueries({ queryKey: ['rag-sessions'] });
      showSuccess('RAG chat session deleted');
    },
    onError: () => {
      showError('Failed to delete RAG chat session');
    },
  });

  // Send message in RAG session
  const sendMessageMutation = useMutation({
    mutationFn: async ({ message, documentIds }: { message: string; documentIds?: string[] }) => {
      if (!activeSessionId) {
        throw new Error('No active session');
      }
      
      return await ragChatSessionsApiService.sendMessage({
        message,
        sessionId: activeSessionId,
        documentIds,
        model: selectedModel?.id || 'llama-3.1-8b-instant',
        includeContext: true,
        maxTokens: 1000,
      });
    },
    onSuccess: (response) => {
      // Add user message
      const userMessage: RAGChatMessage = {
        id: `user_${Date.now()}`,
        message: sendMessageMutation.variables?.message || '',
        response: '',
        sources: [],
        timestamp: new Date().toISOString(),
        conversationId: response.sessionId,
      };

      // Add AI response
      const aiMessage: RAGChatMessage = {
        id: `ai_${Date.now()}`,
        message: '',
        response: response.response,
        sources: response.sources,
        timestamp: response.timestamp,
        conversationId: response.sessionId,
      };

      addMessage(userMessage);
      addMessage(aiMessage);
      
      // Update session message count
      if (activeSessionId) {
        updateSession(activeSessionId, { 
          messageCount: messages.length + 2,
          updatedAt: new Date().toISOString()
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ['rag-session-messages', activeSessionId] });
    },
    onError: (error: any) => {
      showError('Failed to get response from knowledge base');
      console.error('RAG chat error:', error);
    },
  });

  // Create new session
  const createNewSession = useCallback(async (title?: string) => {
    await createSessionMutation.mutateAsync(title);
  }, [createSessionMutation]);

  // Delete session
  const deleteRAGSession = useCallback(async (sessionId: string) => {
    await deleteSessionMutation.mutateAsync(sessionId);
  }, [deleteSessionMutation]);

  // Send message
  const sendMessage = useCallback(async (message: string, documentIds?: string[]) => {
    if (!message.trim()) return;
    
    setLoading(true);
    setStreaming(true);
    
    try {
      await sendMessageMutation.mutateAsync({
        message: message.trim(),
        documentIds,
      });
    } finally {
      setLoading(false);
      setStreaming(false);
    }
  }, [sendMessageMutation, setLoading, setStreaming]);

  // Clear conversation
  const clearConversation = useCallback(() => {
    clearMessages();
    if (activeSessionId) {
      updateSession(activeSessionId, { 
        messageCount: 0,
        updatedAt: new Date().toISOString()
      });
    }
  }, [clearMessages, activeSessionId, updateSession]);

  // Retry last message
  const retryLastMessage = useCallback(() => {
    if (messages.length > 0) {
      const lastUserMessage = messages[messages.length - 2];
      if (lastUserMessage && lastUserMessage.message) {
        sendMessage(lastUserMessage.message);
      }
    }
  }, [messages, sendMessage]);

  // Auto-create session if none exists
  useEffect(() => {
    if (!activeSessionId && sessions.length === 0 && !sessionsLoading) {
      createNewSession('New RAG Chat');
    }
  }, [activeSessionId, sessions.length, sessionsLoading, createNewSession]);

  return {
    // State
    sessions,
    activeSessionId,
    messages,
    isLoading: sessionsLoading || messagesLoading,
    isChatting: sendMessageMutation.isPending,
    
    // Actions
    createNewSession,
    deleteRAGSession,
    setActiveSession,
    sendMessage,
    clearConversation,
    retryLastMessage,
    
    // Mutations
    createSessionMutation,
    deleteSessionMutation,
    sendMessageMutation,
  };
}
