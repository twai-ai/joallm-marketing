import React, { useState, useRef, useEffect } from 'react';
import { Send, Image, Paperclip, Mic, MoreVertical, Copy, ThumbsUp, ThumbsDown } from 'lucide-react';
import { PromptComposer } from './PromptComposer';
import { MessageList } from './MessageList';
import { PromptTemplates } from './PromptTemplates';
import { useUserRole } from '../../contexts/EnhancedUserRoleContext';
import { useLLM } from '../../contexts/LLMContext';
import { API_ENDPOINTS } from '../../config/api';
import { getAuthToken } from '../../utils/storage';

export type Message = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  model?: string;
  attachments?: Array<{ type: 'image' | 'file'; name: string; url: string }>;
  isStreaming?: boolean;
};

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'system',
      content: 'Welcome to ATRISI Marketing — institutional knowledge and relationship intelligence. Chat with grounded answers, open Studio for Media AI / Document AI / Acquisition, and keep Timelines and Knowledge Artifacts on the Platform.',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { getRoleConfig } = useUserRole();
  const { selectedModel } = useLLM();
  const roleConfig = getRoleConfig();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Create assistant message placeholder for streaming
    const assistantMessage: Message = {
      id: `msg-${Date.now()}-response`,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      model: selectedModel.name,
      isStreaming: true,
    };

    setMessages(prev => [...prev, assistantMessage]);

    try {
      // Call the backend streaming API
      
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
          messages: messages.concat(userMessage).map(msg => ({
            id: msg.id,
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp.toISOString(),
            model: msg.model,
          })),
          model: selectedModel.id,
          parameters: {
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
        console.error('Response error:', errorText);
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      // Handle Server-Sent Events stream
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
                // Update message content with streamed chunk
                setMessages(prev => prev.map(msg =>
                  msg.id === assistantMessage.id
                    ? { ...msg, content: msg.content + parsed.content }
                    : msg
                ));
              }

              if (parsed.done) {
                // Mark streaming as complete
                setMessages(prev => prev.map(msg =>
                  msg.id === assistantMessage.id
                    ? { ...msg, isStreaming: false }
                    : msg
                ));
                setIsLoading(false);
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
      console.error('Error details:', errorMessage);
      
      setMessages(prev => prev.map(msg =>
        msg.id === assistantMessage.id
          ? {
              ...msg,
              content: `Error: ${errorMessage}\n\nBackend URL: ${API_ENDPOINTS.chat.stream}\nModel: ${selectedModel.id}\n\nPlease check:\n1. Backend is running: curl http://localhost:3001/api/health\n2. Browser console for details (F12)`,
              isStreaming: false,
            }
          : msg
      ));
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTemplateSelect = (template: any) => {
    setInput(template.prompt);
    setShowTemplates(false);
  };

  const handleEditMessage = (messageId: string) => {
    const message = messages.find(m => m.id === messageId);
    if (message && message.role === 'user') {
      setInput(message.content);
      setEditingMessageId(messageId);
      // Remove the message and all subsequent messages
      const messageIndex = messages.findIndex(m => m.id === messageId);
      setMessages(messages.slice(0, messageIndex));
    }
  };

  const handleRegenerateMessage = async (messageId: string) => {
    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;

    // Find the last user message before this assistant message
    const lastUserMessage = messages.slice(0, messageIndex).reverse().find(m => m.role === 'user');
    if (!lastUserMessage) return;

    // Remove the assistant message and everything after it
    const newMessages = messages.slice(0, messageIndex);
    setMessages(newMessages);

    // Resend the user message
    setIsLoading(true);

    // Create assistant message placeholder for streaming
    const assistantMessage: Message = {
      id: `msg-${Date.now()}-response`,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      model: selectedModel.name,
      isStreaming: true,
    };

    setMessages(prev => [...prev, assistantMessage]);

    try {
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
          messages: newMessages.concat(lastUserMessage).map(msg => ({
            id: msg.id,
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp.toISOString(),
            model: msg.model,
          })),
          model: selectedModel.id,
          parameters: {
            temperature: 0.7,
            maxTokens: 2048,
            topP: 1.0,
            frequencyPenalty: 0.0,
            presencePenalty: 0.0,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
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
                setMessages(prev => prev.map(msg =>
                  msg.id === assistantMessage.id
                    ? { ...msg, content: msg.content + parsed.content }
                    : msg
                ));
              }

              if (parsed.done) {
                setMessages(prev => prev.map(msg =>
                  msg.id === assistantMessage.id
                    ? { ...msg, isStreaming: false }
                    : msg
                ));
                setIsLoading(false);
              }
            } catch (e) {
              console.error('Failed to parse SSE data:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('Regenerate request failed:', error);
      setMessages(prev => prev.map(msg =>
        msg.id === assistantMessage.id
          ? {
              ...msg,
              content: `Error regenerating response: ${error instanceof Error ? error.message : 'Unknown error'}`,
              isStreaming: false,
            }
          : msg
      ));
      setIsLoading(false);
    }
  };

  const handleDeleteMessage = (messageId: string) => {
    if (confirm('Are you sure you want to delete this message?')) {
      setMessages(messages.filter(m => m.id !== messageId));
    }
  };

  const handleShareMessage = (messageId: string) => {
    const message = messages.find(m => m.id === messageId);
    if (message) {
      const shareText = `${message.role === 'user' ? 'You' : 'Assistant'}: ${message.content}`;
      navigator.clipboard.writeText(shareText);
      // Show success toast (would need to import from toast utils)
      console.log('Message copied to clipboard');
    }
  };

  return (
    <div className="flex h-full min-h-0">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6 min-h-0">
          <MessageList 
            messages={messages}
            onEditMessage={handleEditMessage}
            onRegenerateMessage={handleRegenerateMessage}
            onDeleteMessage={handleDeleteMessage}
          />
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area - Fixed at bottom */}
        <div className="flex-shrink-0 border-t border-gray-100 p-4 bg-white sticky bottom-0 z-10">
          <PromptComposer
            value={input}
            onChange={setInput}
            onSend={handleSend}
            onKeyPress={handleKeyPress}
            isLoading={isLoading}
            placeholder={`Ask ${selectedModel.name} anything...`}
          />
          
          {/* Quick Actions - Simplified */}
          <div className="flex items-center justify-between mt-2">
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className="text-xs text-gray-600 hover:text-gray-800"
            >
              {showTemplates ? 'Hide Templates' : 'Show Templates'}
            </button>
            
            <span className="text-xs text-gray-400">⏎ to send</span>
          </div>
        </div>
      </div>

      {/* Templates Sidebar */}
      {showTemplates && (
        <div className="w-80 border-l border-gray-100 bg-gray-50">
          <PromptTemplates
            templates={roleConfig.defaultPrompts}
            onSelect={handleTemplateSelect}
          />
        </div>
      )}
    </div>
  );
}