// Custom hook for chat operations
import { useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../utils/api-client';
import { API_ENDPOINTS } from '../config/api';
import { ChatSession, Message } from '../types';
import { useChatStore } from '../stores/chatStore';
import { showSuccess, showError } from '../utils/toast';
import { getAuthToken, storage, STORAGE_KEYS } from '../utils/storage';

export function useChat() {
  const queryClient = useQueryClient();
  const sessionStatusRef = useRef<Map<string, 'completed' | 'abandoned'>>(new Map());
  const {
    activeSessionId,
    messages,
    setMessages,
    addMessage,
    updateMessage,
    setLoading,
    setStreamingMessageId,
    setSessions,
    addSession,
    deleteSession,
    setActiveSession,
  } = useChatStore();

  const persistSessionStatus = async (
    sessionId: string,
    status: 'completed' | 'abandoned',
    options?: { keepalive?: boolean }
  ) => {
    if (!sessionId || sessionStatusRef.current.has(sessionId)) {
      return;
    }

    sessionStatusRef.current.set(sessionId, status);
    const payload = JSON.stringify({ status });

    try {
      if (options?.keepalive && typeof window !== 'undefined') {
        const token = storage.getSecure<string>(STORAGE_KEYS.AUTH_TOKEN);

        if (token) {
          await fetch(API_ENDPOINTS.chat.sessionComplete(sessionId), {
            method: 'PATCH',
            keepalive: true,
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: payload,
          });
          return;
        }

        if (navigator.sendBeacon) {
          navigator.sendBeacon(
            API_ENDPOINTS.chat.sessionComplete(sessionId),
            new Blob([payload], { type: 'application/json' }),
          );
          return;
        }
      }

      await apiClient.patch(
        API_ENDPOINTS.chat.sessionComplete(sessionId),
        { status },
        { showErrorToast: false, retries: 0 },
      );
    } catch {
      sessionStatusRef.current.delete(sessionId);
    }
  };

  const markCurrentSessionCompleted = async () => {
    const currentSessionId = useChatStore.getState().activeSessionId;
    const currentMessages = useChatStore.getState().messages || [];

    if (!currentSessionId || currentMessages.length === 0) {
      return;
    }

    await persistSessionStatus(currentSessionId, 'completed');
  };

  useEffect(() => {
    const handleBeforeUnload = () => {
      const currentSessionId = useChatStore.getState().activeSessionId;
      const currentMessages = useChatStore.getState().messages || [];

      if (!currentSessionId || currentMessages.length === 0 || sessionStatusRef.current.has(currentSessionId)) {
        return;
      }

      void persistSessionStatus(currentSessionId, 'abandoned', { keepalive: true });
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  useEffect(() => {
    return () => {
      const currentSessionId = useChatStore.getState().activeSessionId;
      const currentMessages = useChatStore.getState().messages || [];

      if (!currentSessionId || currentMessages.length === 0 || sessionStatusRef.current.has(currentSessionId)) {
        return;
      }

      void persistSessionStatus(currentSessionId, 'completed', { keepalive: true });
    };
  }, []);

  // Fetch chat sessions
  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ['chat-sessions'],
    queryFn: async () => {
      const response = await apiClient.get<{ sessions: ChatSession[]; pagination: any }>(API_ENDPOINTS.chat.sessions);
      // Backend now returns { sessions: [...], pagination: {...} }, extract the sessions array
      const sessionsArray = response.sessions || [];
      setSessions(sessionsArray);
      return sessionsArray;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - prevent excessive refetching
    refetchOnMount: false, // Don't refetch on component mount
    refetchOnWindowFocus: false, // Don't refetch when window gains focus
  });

  // Fetch messages for active session
  const { data: sessionMessages, isLoading: messagesLoading } = useQuery({
    queryKey: ['chat-messages', activeSessionId],
    queryFn: async () => {
      if (!activeSessionId) return [];
      try {
        const response = await apiClient.get<{ messages: Message[] }>(
          API_ENDPOINTS.chat.history(activeSessionId)
        );
        // Backend returns { messages: [...] }, extract the array
        const messagesArray = response.messages || [];
        setMessages(messagesArray);
        return messagesArray;
      } catch (error: any) {
        // If session not found (404), clear the invalid session ID
        if (error?.status === 404 || error?.response?.status === 404) {
          console.warn(`Session ${activeSessionId} not found, clearing from storage`);
          setActiveSession(null);
          storage.remove(STORAGE_KEYS.ACTIVE_CHAT_SESSION);
        }
        throw error;
      }
    },
    enabled: !!activeSessionId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: false, // Don't retry on 404 errors
  });

  // Create new session
  const createSessionMutation = useMutation({
    mutationFn: async (title?: string) => {
      return await apiClient.post<ChatSession>(API_ENDPOINTS.chat.sessions, {
        title: title || 'New Chat',
      });
    },
    onSuccess: (session) => {
      addSession(session);
      setActiveSession(session.id);
      setMessages([]); // Clear messages for new session
      queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['chat-messages', session.id] });
      
      // Navigate to new session URL
      if (typeof window !== 'undefined') {
        const navigate = (window as any).__navigate;
        if (navigate && session.shortId) {
          navigate(`/chat/${session.shortId}`, { replace: true });
        }
      }
      
      showSuccess('New chat session created');
    },
    onError: () => {
      showError('Failed to create chat session');
    },
  });

  // Delete session
  const deleteSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      await apiClient.delete(API_ENDPOINTS.chat.delete(sessionId));
    },
    onSuccess: (_, sessionId) => {
      deleteSession(sessionId);
      queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
      sessionStatusRef.current.delete(sessionId);
      showSuccess('Chat session deleted');
    },
    onError: () => {
      showError('Failed to delete chat session');
    },
  });

  // Send message with streaming
  const sendMessage = async (
    content: string, 
    modelId: string, 
    attachments?: Array<{ type: 'image' | 'file'; name: string; url: string }>,
    selectedDocumentIds?: string[],
    parameters?: {
      temperature?: number;
      maxTokens?: number;
      topP?: number;
      frequencyPenalty?: number;
      presencePenalty?: number;
    }
  ) => {
    let currentSessionId = activeSessionId;
    
    if (!currentSessionId) {
      // Create new session if none exists
      try {
        const session = await createSessionMutation.mutateAsync('New Chat');
        currentSessionId = session.id;
        setActiveSession(session.id);
      } catch (error) {
        console.error('Failed to create session:', error);
        showError('Failed to create chat session. Please try again.');
        return;
      }
    }

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      sessionId: currentSessionId,
      role: 'user',
      content,
      timestamp: new Date(),
      attachments: attachments || [],
    };

    addMessage(userMessage);
    setLoading(true);

    const assistantMessage: Message = {
      id: `msg-${Date.now()}-response`,
      sessionId: currentSessionId,
      role: 'assistant',
      content: '',
      model: modelId,
      timestamp: new Date(),
    };

    addMessage(assistantMessage);
    setStreamingMessageId(assistantMessage.id);

    try {
      // Build messages array including history
      const currentMessages = useChatStore.getState().messages;
      const messagesToSend = currentMessages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp instanceof Date ? msg.timestamp.toISOString() : msg.timestamp,
        model: msg.model,
        attachments: msg.attachments || [],
      }));

      // Get auth token for authenticated requests
      const token = await getAuthToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(API_ENDPOINTS.chat.stream, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          sessionId: currentSessionId,
          messages: messagesToSend,
          model: modelId,
          selectedDocumentIds: selectedDocumentIds || [],
          parameters: parameters || {
            temperature: 0.7,
            maxTokens: 2048,
            topP: 1.0,
            frequencyPenalty: 0.0,
            presencePenalty: 0.0,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Chat stream error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        });
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No reader available');
      }

      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            try {
              const parsed = JSON.parse(data);

              if (parsed.content) {
                // Get the current message content from store
                const currentMsg = useChatStore.getState().messages.find(m => m.id === assistantMessage.id);
                const currentContent = currentMsg?.content || '';
                updateMessage(assistantMessage.id, {
                  content: currentContent + parsed.content,
                });
              }

              if (parsed.done) {
                setStreamingMessageId(null);
                setLoading(false);
                queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
                queryClient.invalidateQueries({ queryKey: ['chat-messages', currentSessionId] });
              }
            } catch (e) {
              console.error('Failed to parse SSE data:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('Chat request failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      updateMessage(assistantMessage.id, {
        content: `Error: ${errorMessage}\n\nPlease check:\n1. Backend is running (http://localhost:3001)\n2. API keys are configured\n3. Selected model is available`,
      });
      setStreamingMessageId(null);
      setLoading(false);
      showError('Failed to send message', errorMessage);
    }
  };


  return {
    // State
    sessions: sessions || [],
    activeSessionId,
    messages: messages || [], // Ensure messages is always an array
    isLoading: messagesLoading || sessionsLoading,
    isSending: useChatStore((state) => state.isLoading),

    // Actions
    createSession: (title?: string) => {
      // Use mutate for fire-and-forget, navigation handled in onSuccess
      void markCurrentSessionCompleted().finally(() => {
        createSessionMutation.mutate(title);
      });
    },
    deleteSession: deleteSessionMutation.mutate,
    setActiveSession: (sessionId: string | null) => {
      const currentSessionId = useChatStore.getState().activeSessionId;
      if (currentSessionId && sessionId && currentSessionId !== sessionId) {
        void markCurrentSessionCompleted().finally(() => {
          setActiveSession(sessionId);
        });
        return;
      }

      setActiveSession(sessionId);
    },
    sendMessage,
    updateMessage,
    deleteMessage: (messageId: string) => {
      const message = (messages || []).find(m => m.id === messageId);
      if (message) {
        useChatStore.getState().deleteMessage(messageId);
      }
    },
  };
}
