import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface RAGSearchSession {
  id: string;
  shortId: string;
  title: string;
  searchType: 'vector' | 'keyword' | 'hybrid';
  userId?: string;
  parameters: {
    limit: number;
    threshold: number;
    vectorWeight: number;
    keywordWeight: number;
    includeMetadata: boolean;
  };
  documentIds: string[];
  createdAt: string;
  updatedAt: string;
  queryCount: number;
}

export interface RAGSearchQuery {
  id: string;
  sessionId: string;
  query: string;
  enhancedQuery?: string;
  resultsCount: number;
  searchTime: number;
  averageScore?: number;
  searchType: 'vector' | 'keyword' | 'hybrid';
  parameters: {
    limit: number;
    threshold: number;
    vectorWeight: number;
    keywordWeight: number;
    includeMetadata: boolean;
  };
  success: boolean;
  errorMessage?: string;
  createdAt: string;
}

interface RAGSessionStore {
  // State
  sessions: RAGSearchSession[];
  activeSessionId: string | null;
  queries: RAGSearchQuery[];
  isLoading: boolean;
  
  // Actions
  setSessions: (sessions: RAGSearchSession[]) => void;
  addSession: (session: RAGSearchSession) => void;
  updateSession: (sessionId: string, updates: Partial<RAGSearchSession>) => void;
  deleteSession: (sessionId: string) => void;
  setActiveSession: (sessionId: string | null) => void;
  
  setQueries: (queries: RAGSearchQuery[]) => void;
  addQuery: (query: RAGSearchQuery) => void;
  
  setLoading: (loading: boolean) => void;
  
  clearQueries: () => void;
  reset: () => void;
}

export const useRAGSessionStore = create<RAGSessionStore>()(
  persist(
    (set) => ({
      // Initial state
      sessions: [],
      activeSessionId: null,
      queries: [],
      isLoading: false,
      
      // Actions
      setSessions: (sessions) => set({ sessions }),
      
      addSession: (session) => set((state) => ({
        sessions: [session, ...state.sessions],
      })),
      
      updateSession: (sessionId, updates) => set((state) => ({
        sessions: state.sessions.map((s) =>
          s.id === sessionId ? { ...s, ...updates } : s
        ),
      })),
      
      deleteSession: (sessionId) => set((state) => ({
        sessions: state.sessions.filter((s) => s.id !== sessionId),
        activeSessionId: state.activeSessionId === sessionId ? null : state.activeSessionId,
      })),
      
      setActiveSession: (sessionId) => set({ activeSessionId: sessionId, queries: [] }),
      
      setQueries: (queries) => set({ queries }),
      
      addQuery: (query) => set((state) => ({
        queries: [query, ...state.queries],
      })),
      
      setLoading: (loading) => set({ isLoading: loading }),
      
      clearQueries: () => set({ queries: [] }),
      
      reset: () => set({
        sessions: [],
        activeSessionId: null,
        queries: [],
        isLoading: false,
      }),
    }),
    {
      name: 'rag-session-storage',
      partialize: (state) => ({
        sessions: state.sessions,
        activeSessionId: state.activeSessionId,
      }),
    }
  )
);
