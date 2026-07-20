import { useState, useCallback, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ragChatService, RAGChatMessage, RAGChatRequest, RAGChatResponse, RAGModeId } from '../services/ragChatApi';
import { showError } from '../utils/toast';
import { storage, STORAGE_KEYS } from '../utils/storage';
import { mapBackendChatSource } from '../domain/chat';

export function useRAGChat(selectedModelId?: string, mode: RAGModeId = 'standard') {
  // Generate a more persistent conversation ID
  const generateConversationId = () => {
    const existingId = storage.get<string>(STORAGE_KEYS.ACTIVE_CHAT_SESSION);
    if (existingId && existingId.startsWith('rag_conv_')) {
      return existingId;
    }
    const newId = `rag_conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    storage.set(STORAGE_KEYS.ACTIVE_CHAT_SESSION, newId);
    return newId;
  };

  const [conversationId, setConversationId] = useState<string>(generateConversationId);
  const [messages, setMessages] = useState<RAGChatMessage[]>([]);

  // Persist conversation ID changes
  useEffect(() => {
    storage.set(STORAGE_KEYS.ACTIVE_CHAT_SESSION, conversationId);
  }, [conversationId]);

  const chatMutation = useMutation({
    mutationFn: async (request: RAGChatRequest) => {
      return await ragChatService.sendMessage({
        ...request,
        conversationId: conversationId
      });
    },
    onSuccess: (response: RAGChatResponse) => {
      // Add user message
      const userMessage: RAGChatMessage = {
        id: `user_${Date.now()}`,
        message: chatMutation.variables?.message || '',
        response: '',
        sources: [],
        timestamp: new Date().toISOString(),
        conversationId: response.conversationId,
        mode: chatMutation.variables?.mode,
      };

      // Add AI response
      const aiMessage: RAGChatMessage = {
        id: `ai_${Date.now()}`,
        message: '',
        response: response.response,
        sources: response.sources.map(mapBackendChatSource),
        timestamp: response.timestamp,
        conversationId: response.conversationId,
        mode: response.mode,
      };

      setMessages(prev => [...prev, userMessage, aiMessage]);
      setConversationId(response.conversationId);
    },
    onError: (error: any) => {
      showError('Failed to get response from knowledge base');
      console.error('RAG chat error:', error);
    }
  });

  const sendMessage = useCallback(async (message: string, documentIds?: string[]) => {
    if (!message.trim()) return;

    await chatMutation.mutateAsync({
      message: message.trim(),
      documentIds,
      includeContext: true,
      maxTokens: 1000,
      model: selectedModelId || 'llama-3.1-8b-instant',
      mode,
    });
  }, [chatMutation, selectedModelId]);

  const clearConversation = useCallback(() => {
    setMessages([]);
    const newId = `rag_conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setConversationId(newId);
    storage.set(STORAGE_KEYS.ACTIVE_CHAT_SESSION, newId);
  }, []);

  const retryLastMessage = useCallback(() => {
    if (messages.length > 0) {
      const lastUserMessage = messages[messages.length - 2];
      if (lastUserMessage && lastUserMessage.message) {
        sendMessage(lastUserMessage.message);
      }
    }
  }, [messages, sendMessage]);

  return {
    messages,
    conversationId,
    sendMessage,
    clearConversation,
    retryLastMessage,
    isChatting: chatMutation.isPending,
    error: chatMutation.error
  };
}
