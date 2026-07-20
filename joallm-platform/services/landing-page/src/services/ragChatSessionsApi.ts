import { apiClient } from '../utils/api-client';
import { API_ENDPOINTS } from '../config/api';
import { RAGChatSession, RAGChatMessage } from '../stores/ragChatStore';

export interface RAGChatSessionRequest {
  title?: string;
  model?: string;
  documentIds?: string[];
}

export interface RAGChatMessageRequest {
  message: string;
  sessionId: string;
  documentIds?: string[];
  includeContext?: boolean;
  maxTokens?: number;
  model?: string;
}

export interface RAGChatMessageResponse {
  response: string;
  sources: Array<{
    id: string;
    filename: string;
    content: string;
    score: number;
    chunkIndex: number;
  }>;
  sessionId: string;
  timestamp: string;
}

export class RAGChatSessionsApiService {
  /**
   * Get all RAG chat sessions
   */
  async getSessions(): Promise<RAGChatSession[]> {
    const response = await apiClient.get<{ sessions: RAGChatSession[]; pagination: any }>(
      API_ENDPOINTS.rag.sessions
    );
    return response.sessions || [];
  }

  /**
   * Create a new RAG chat session
   */
  async createSession(request: RAGChatSessionRequest): Promise<RAGChatSession> {
    return await apiClient.post<RAGChatSession>(API_ENDPOINTS.rag.sessions, request);
  }

  /**
   * Get a specific RAG chat session
   */
  async getSession(sessionId: string): Promise<RAGChatSession> {
    return await apiClient.get<RAGChatSession>(`${API_ENDPOINTS.rag.sessions}/${sessionId}`);
  }

  /**
   * Update a RAG chat session
   */
  async updateSession(sessionId: string, updates: Partial<RAGChatSession>): Promise<RAGChatSession> {
    return await apiClient.patch<RAGChatSession>(`${API_ENDPOINTS.rag.sessions}/${sessionId}`, updates);
  }

  /**
   * Delete a RAG chat session
   */
  async deleteSession(sessionId: string): Promise<void> {
    await apiClient.delete(`${API_ENDPOINTS.rag.sessions}/${sessionId}`);
  }

  /**
   * Get messages for a RAG chat session
   */
  async getSessionMessages(sessionId: string): Promise<RAGChatMessage[]> {
    const response = await apiClient.get<{ messages: RAGChatMessage[] }>(
      `${API_ENDPOINTS.rag.sessions}/${sessionId}/messages`
    );
    return response.messages || [];
  }

  /**
   * Send a message in a RAG chat session
   */
  async sendMessage(request: RAGChatMessageRequest): Promise<RAGChatMessageResponse> {
    return await apiClient.post<RAGChatMessageResponse>(
      `${API_ENDPOINTS.rag.sessions}/${request.sessionId}/messages`,
      request
    );
  }
}

export const ragChatSessionsApiService = new RAGChatSessionsApiService();
