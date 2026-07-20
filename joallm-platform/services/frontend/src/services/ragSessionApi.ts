import { apiClient } from '../utils/api-client';
import { API_ENDPOINTS } from '../config/api';
import { RAGSearchSession, RAGSearchQuery } from '../stores/ragSessionStore';

export interface CreateRAGSessionRequest {
  title?: string;
  searchType?: 'vector' | 'keyword' | 'hybrid';
  parameters?: {
    limit: number;
    threshold: number;
    vectorWeight: number;
    keywordWeight: number;
    includeMetadata: boolean;
  };
  documentIds?: string[];
}

export interface RAGSessionListResponse {
  sessions: RAGSearchSession[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface RAGQueryListResponse {
  queries: RAGSearchQuery[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export class RAGSessionApiService {
  // Create a new RAG search session
  async createSession(data: CreateRAGSessionRequest): Promise<RAGSearchSession> {
    const response = await apiClient.post<RAGSearchSession>(
      API_ENDPOINTS.rag.sessions,
      data
    );
    return response;
  }

  // Get all RAG search sessions
  async getSessions(
    page: number = 1,
    limit: number = 20,
    search?: string
  ): Promise<RAGSessionListResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    
    if (search) {
      params.append('search', search);
    }

    const response = await apiClient.get<RAGSessionListResponse>(
      `${API_ENDPOINTS.rag.sessions}?${params.toString()}`
    );
    return response;
  }

  // Get queries for a specific session
  async getSessionQueries(
    sessionId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<RAGQueryListResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    const response = await apiClient.get<RAGQueryListResponse>(
      `${API_ENDPOINTS.rag.sessions}/${sessionId}/queries?${params.toString()}`
    );
    return response;
  }

  // Delete a RAG search session
  async deleteSession(sessionId: string): Promise<void> {
    await apiClient.delete(`${API_ENDPOINTS.rag.sessions}/${sessionId}`);
  }

  // Update a RAG search session
  async updateSession(
    sessionId: string,
    updates: Partial<CreateRAGSessionRequest>
  ): Promise<RAGSearchSession> {
    const response = await apiClient.patch<RAGSearchSession>(
      `${API_ENDPOINTS.rag.sessions}/${sessionId}`,
      updates
    );
    return response;
  }
}

export const ragSessionApiService = new RAGSessionApiService();
