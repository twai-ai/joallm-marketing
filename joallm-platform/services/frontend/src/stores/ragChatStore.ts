import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { storage } from '../utils/storage';

export interface RAGChatSession {
  id: string;
  shortId: string;
  title: string;
  model: string;
  userId?: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  documentIds?: string[];
}

export interface RAGChatMessage {
  id: string;
  message: string;
  response: string;
  sources: Array<{
    id: string;
    filename: string;
    content: string;
    score: number;
    chunkIndex: number;
  }>;
  timestamp: string;
  conversationId: string;
}

interface RAGChatState {
  // Sessions
  sessions: RAGChatSession[];
  activeSessionId: string | null;
  
  // Messages
  messages: RAGChatMessage[];
  
  // UI State
  isLoading: boolean;
  isStreaming: boolean;
  streamingMessageId: string | null;
  
  // Actions
  setSessions: (sessions: RAGChatSession[]) => void;
  addSession: (session: RAGChatSession) => void;
  updateSession: (sessionId: string, updates: Partial<RAGChatSession>) => void;
  deleteSession: (sessionId: string) => void;
  setActiveSession: (sessionId: string | null) => void;
  
  // Messages
  setMessages: (messages: RAGChatMessage[]) => void;
  addMessage: (message: RAGChatMessage) => void;
  updateMessage: (messageId: string, updates: Partial<RAGChatMessage>) => void;
  clearMessages: () => void;
  
  // UI Actions
  setLoading: (loading: boolean) => void;
  setStreaming: (streaming: boolean) => void;
  setStreamingMessageId: (messageId: string | null) => void;
}

export const useRAGChatStore = create<RAGChatState>()(
  persist(
    (set, get) => ({
      // Initial state
      sessions: [],
      activeSessionId: null,
      messages: [],
      isLoading: false,
      isStreaming: false,
      streamingMessageId: null,

      // Session actions
      setSessions: (sessions) => set({ sessions }),
      
      addSession: (session) => set((state) => ({
        sessions: [session, ...state.sessions],
        activeSessionId: session.id,
        messages: [] // Clear messages for new session
      })),
      
      updateSession: (sessionId, updates) => set((state) => ({
        sessions: state.sessions.map(session =>
          session.id === sessionId ? { ...session, ...updates } : session
        )
      })),
      
      deleteSession: (sessionId) => set((state) => ({
        sessions: state.sessions.filter(session => session.id !== sessionId),
        activeSessionId: state.activeSessionId === sessionId ? null : state.activeSessionId,
        messages: state.activeSessionId === sessionId ? [] : state.messages
      })),
      
      setActiveSession: (sessionId) => set((state) => ({
        activeSessionId: sessionId,
        messages: sessionId ? [] : state.messages // Clear messages when switching sessions
      })),

      // Message actions
      setMessages: (messages) => set({ messages }),
      
      addMessage: (message) => set((state) => ({
        messages: [...state.messages, message]
      })),
      
      updateMessage: (messageId, updates) => set((state) => ({
        messages: state.messages.map(message =>
          message.id === messageId ? { ...message, ...updates } : message
        )
      })),
      
      clearMessages: () => set({ messages: [] }),

      // UI actions
      setLoading: (loading) => set({ isLoading: loading }),
      setStreaming: (streaming) => set({ isStreaming: streaming }),
      setStreamingMessageId: (messageId) => set({ streamingMessageId: messageId }),
    }),
    {
      name: 'rag-chat-store',
      storage: storage,
      partialize: (state) => ({
        sessions: state.sessions,
        activeSessionId: state.activeSessionId,
      }),
    }
  )
);
