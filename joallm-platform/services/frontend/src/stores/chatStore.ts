// Chat store using Zustand with persistence
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ChatSession, Message } from '../types';

interface ChatStore {
  // Sessions
  sessions: ChatSession[];
  activeSessionId: string | null;
  
  // Messages for current session
  messages: Message[];
  
  // UI state
  isLoading: boolean;
  streamingMessageId: string | null;
  
  // Actions
  setSessions: (sessions: ChatSession[]) => void;
  addSession: (session: ChatSession) => void;
  updateSession: (sessionId: string, updates: Partial<ChatSession>) => void;
  deleteSession: (sessionId: string) => void;
  setActiveSession: (sessionId: string | null) => void;
  
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  updateMessage: (messageId: string, updates: Partial<Message>) => void;
  deleteMessage: (messageId: string) => void;
  
  setLoading: (loading: boolean) => void;
  setStreamingMessageId: (id: string | null) => void;
  
  clearMessages: () => void;
  reset: () => void;
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set) => ({
      // Initial state
      sessions: [],
      activeSessionId: null,
      messages: [],
      isLoading: false,
      streamingMessageId: null,
      
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
      
      setActiveSession: (sessionId) => set({ activeSessionId: sessionId, messages: [] }),
      
      setMessages: (messages) => set({ messages }),
      
      addMessage: (message) => set((state) => ({
        messages: [...state.messages, message],
      })),
      
      updateMessage: (messageId, updates) => set((state) => ({
        messages: state.messages.map((m) =>
          m.id === messageId ? { ...m, ...updates } : m
        ),
      })),
      
      deleteMessage: (messageId) => set((state) => ({
        messages: state.messages.filter((m) => m.id !== messageId),
      })),
      
      setLoading: (loading) => set({ isLoading: loading }),
      
      setStreamingMessageId: (id) => set({ streamingMessageId: id }),
      
      clearMessages: () => set({ messages: [] }),
      
      reset: () => set({
        sessions: [],
        activeSessionId: null,
        messages: [],
        isLoading: false,
        streamingMessageId: null,
      }),
    }),
    {
      name: 'chat-storage',
      partialize: (state) => ({
        sessions: state.sessions,
        activeSessionId: state.activeSessionId,
      }),
    }
  )
);


