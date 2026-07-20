import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ragChatService, RAGChatMessage, RAGChatRequest, RAGChatResponse } from '../services/ragChatApi';
import { showError } from '../utils/toast';

export function useRAGChat(selectedModelId?: string) {
  const [conversationId, setConversationId] = useState<string>(`conv_${Date.now()}`);
  const [messages, setMessages] = useState<RAGChatMessage[]>([]);

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
        conversationId: response.conversationId
      };

      // Add AI response
      const aiMessage: RAGChatMessage = {
        id: `ai_${Date.now()}`,
        message: '',
        response: response.response,
        sources: response.sources,
        timestamp: response.timestamp,
        conversationId: response.conversationId
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
      model: selectedModelId || 'llama-3.1-8b-instant'
    });
  }, [chatMutation, selectedModelId]);

  const clearConversation = useCallback(() => {
    setMessages([]);
    setConversationId(`conv_${Date.now()}`);
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
