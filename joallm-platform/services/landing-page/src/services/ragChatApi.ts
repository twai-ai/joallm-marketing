import { apiClient } from '../utils/api-client';
import { API_ENDPOINTS } from '../config/api';

export interface RAGChatMessage {
  id: string;
  message: string;
  response: string;
  sources: RAGChatSource[];
  timestamp: string;
  conversationId: string;
}

export interface RAGChatSource {
  id: string;
  filename: string;
  content: string;
  score: number;
  chunkIndex: number;
}

export interface RAGChatRequest {
  message: string;
  conversationId?: string;
  documentIds?: string[];
  includeContext?: boolean;
  maxTokens?: number;
  model?: string;
}

export interface RAGChatResponse {
  response: string;
  sources: RAGChatSource[];
  conversationId: string;
  timestamp: string;
}

export class RAGChatService {
  async sendMessage(request: RAGChatRequest): Promise<RAGChatResponse> {
    return await apiClient.post<RAGChatResponse>(API_ENDPOINTS.rag.chat, request);
  }

  async getConversationHistory(conversationId: string): Promise<RAGChatMessage[]> {
    // This would be implemented when we add conversation persistence
    return [];
  }

  async clearConversation(conversationId: string): Promise<void> {
    // This would be implemented when we add conversation persistence
  }
}

export const ragChatService = new RAGChatService();
