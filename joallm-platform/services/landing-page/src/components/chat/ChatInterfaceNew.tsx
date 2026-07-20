import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Send, Database, Settings } from 'lucide-react';
import { PromptComposer } from './PromptComposer';
import { MessageList } from './MessageList';
import { PromptTemplates } from './PromptTemplates';
import { ConversationHistory } from './ConversationHistory';
import { FileUpload } from './FileUpload';
import { RAGContextSelector } from './RAGContextSelector';
import { ExportMenu } from './ExportMenu';
import { ChatHeader } from '../layout/ChatHeader';
import { WelcomeScreen } from './WelcomeScreen';
import { ModelParameters, ModelParameters as ModelParametersType } from '../models/ModelParameters';
import { useUserRole } from '../../contexts/EnhancedUserRoleContext';
import { useLLM } from '../../contexts/LLMContext';
import { useChat } from '../../hooks/useChat';
import { useModelParameters } from '../../hooks/useModelParameters';
import { Attachment } from '../../types';
import { ChatMessageSkeleton } from '../common/LoadingSkeleton';
import { useChatStore } from '../../stores/chatStore';

export function ChatInterfaceNew() {
  const { sessionId } = useParams<{ sessionId?: string }>();
  const navigate = useNavigate();
  
  const [input, setInput] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [showHistory, setShowHistory] = useState(false); // Start hidden for cleaner UI
  const [showRAGSelector, setShowRAGSelector] = useState(false);
  const [showModelParameters, setShowModelParameters] = useState(false);
  const [selectedRAGDocuments, setSelectedRAGDocuments] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { getRoleConfig } = useUserRole();
  const { selectedModel } = useLLM();
  const roleConfig = getRoleConfig();

  // Model parameters hook
  const { parameters: modelParameters } = useModelParameters({
    modelId: selectedModel.id,
    onParametersChange: (params) => {
      // Parameters are automatically saved to localStorage
    }
  });

  const {
    sessions,
    activeSessionId,
    messages,
    isLoading,
    isSending,
    createSession,
    deleteSession,
    setActiveSession,
    sendMessage,
    deleteMessage,
  } = useChat();


  const updateMessage = useChatStore((state) => state.updateMessage);
  const setMessages = useChatStore((state) => state.setMessages);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);

  // Expose navigate to useChat hook for navigation after session creation
  useEffect(() => {
    (window as any).__navigate = navigate;
    return () => {
      delete (window as any).__navigate;
    };
  }, [navigate]);

  // Sync URL with active session - runs only once on mount or when URL changes
  useEffect(() => {
    // Skip if already initialized and URL hasn't changed
    if (hasInitialized && sessionId === activeSessionId) {
      return;
    }

    const initializeSession = async () => {
      // Case 1: URL has a session ID - load that session
      if (sessionId) {
        const session = sessions.find(s => s.shortId === sessionId || s.id === sessionId);
        if (session && session.id !== activeSessionId) {
          setActiveSession(session.id);
          setHasInitialized(true);
        } else if (!session && !hasInitialized) {
          // Session doesn't exist, create new one
          createSession('New Chat');
          setHasInitialized(true);
        }
      } 
      // Case 2: No session ID in URL - need to handle navigation
      else if (!sessionId) {
        if (activeSessionId) {
          // Has active session but no URL - update URL
          const session = sessions.find(s => s.id === activeSessionId);
          if (session?.shortId) {
            navigate(`/chat/${session.shortId}`, { replace: true });
            setHasInitialized(true);
          }
        } else if (!hasInitialized && sessions.length === 0) {
          // No sessions at all - create first one
          createSession('New Chat');
          setHasInitialized(true);
        }
      }
    };

    // Only run if we have sessions data loaded or it's the first load
    if (!isLoading) {
      initializeSession();
    }
  }, [sessionId, activeSessionId, sessions, isLoading, hasInitialized]); // Simplified dependencies to prevent infinite loops

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isSending) return;

    const messageContent = input;
    const messageAttachments = attachments.map(attachment => ({
      type: attachment.type,
      name: attachment.name,
      url: attachment.url || attachment.id, // Use URL if available, otherwise use ID
    }));
    
    setInput('');
    setAttachments([]);

    try {
      await sendMessage(messageContent, selectedModel.id, messageAttachments, modelParameters);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleTemplateSelect = (template: any) => {
    setInput(template.prompt);
    setShowTemplates(false);
  };

  const handleNewChat = async () => {
    try {
      // Clear current state
      setInput('');
      setAttachments([]);
      setSelectedRAGDocuments([]);
      setMessages([]);
      setHasInitialized(false); // Reset initialization flag
      
      // Create a new session explicitly
      createSession('New Chat');
      
      // Note: The createSession callback in useChat will handle navigation
    } catch (error) {
      console.error('Failed to create new chat:', error);
    }
  };

  const handleFileUploaded = (attachment: Attachment) => {
    setAttachments((prev) => [...prev, attachment]);
  };

  const handleRemoveAttachment = (attachmentId: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
  };

  const handleEditMessage = (messageId: string) => {
    const message = messages.find((m) => m.id === messageId);
    if (message) {
      setInput(message.content);
      setEditingMessageId(messageId);
    }
  };

  const handleRegenerateMessage = async (messageId: string) => {
    // Find the user message that prompted this response
    const messageIndex = messages.findIndex((m) => m.id === messageId);
    if (messageIndex > 0) {
      const previousMessage = messages[messageIndex - 1];
      if (previousMessage.role === 'user') {
        // Delete the old assistant message
        deleteMessage(messageId);
        // Resend the user message with attachments
        await sendMessage(previousMessage.content, selectedModel.id, previousMessage.attachments, modelParameters);
      }
    }
  };

  const handleDeleteMessage = (messageId: string) => {
    deleteMessage(messageId);
  };

  // Get active session title for export
  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const sessionTitle = activeSession?.title || 'Chat Conversation';

  return (
    <div className="flex h-full">
      {/* Conversation History Sidebar - Collapsible */}
      {showHistory && (
        <ConversationHistory
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={setActiveSession}
          onDeleteSession={deleteSession}
          onNewChat={handleNewChat}
        />
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header with History Toggle and Export */}
        <ChatHeader
          sessionId={activeSessionId}
          sessionTitle={sessionTitle}
          onNewChat={handleNewChat}
          onToggleHistory={() => setShowHistory(!showHistory)}
          showHistory={showHistory}
          messageCount={messages.length}
          messages={messages || []}
          onBackToWelcome={messages.length > 0 ? () => {
            // Clear messages to show welcome screen
            setMessages([]);
            setInput('');
          } : undefined}
          onTitleUpdate={(newTitle) => {
            // Update the active session title in store
            const updatedSessions = sessions.map(s =>
              s.id === activeSessionId ? { ...s, title: newTitle } : s
            );
            // This would ideally update the store, but for now just refetch
          }}
          autoGenerated={activeSession?.autoTitle}
        />
        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6 relative" style={{ maxHeight: 'calc(100vh - 200px)' }}>
          {isLoading && messages.length === 0 ? (
            <ChatMessageSkeleton />
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-md">
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                  Ready to chat?
                </h2>
                <p className="text-gray-600 mb-4">
                  Start typing below or use the sidebar to explore features
                </p>
                <p className="text-sm text-gray-500">
                  💡 Tip: Use the hamburger menu (☰) to access quick prompts and navigation
                </p>
              </div>
            </div>
          ) : (
            <>
              <MessageList 
                messages={messages}
                onEditMessage={handleEditMessage}
                onRegenerateMessage={handleRegenerateMessage}
                onDeleteMessage={handleDeleteMessage}
              />
              <div ref={messagesEndRef} />
            </>
          )}

          {/* Export Menu - moved to header as dropdown */}
        </div>

        {/* Input Area */}
        <div className="flex-shrink-0 border-t border-gray-100 p-4 bg-white relative sticky bottom-0 z-10" style={{ minHeight: '120px' }}>
          {/* RAG Context Selector */}
          {showRAGSelector && (
            <RAGContextSelector
              selectedDocuments={selectedRAGDocuments}
              onSelectDocuments={setSelectedRAGDocuments}
              onClose={() => setShowRAGSelector(false)}
            />
          )}

          {/* RAG Context Indicator */}
          {selectedRAGDocuments.length > 0 && (
            <div className="mb-2 flex items-center gap-2 text-sm text-red-700 bg-red-50 px-3 py-2 rounded-lg">
              <Database className="w-4 h-4" />
              <span>
                Using {selectedRAGDocuments.length} document{selectedRAGDocuments.length > 1 ? 's' : ''} for context
              </span>
              <button
                onClick={() => setSelectedRAGDocuments([])}
                className="ml-auto text-joa-primary hover:text-red-800"
              >
                ✕
              </button>
            </div>
          )}

          {/* Model Parameters */}
          <div className="mb-3">
            <ModelParameters 
              onParametersChange={(params) => {
                // Parameters are automatically managed by the hook
              }}
            />
          </div>

          {/* File Attachments */}
          {attachments.length > 0 && (
            <div className="mb-3">
              <FileUpload
                onFileUploaded={handleFileUploaded}
                onRemove={handleRemoveAttachment}
                attachments={attachments}
              />
            </div>
          )}

          <PromptComposer
            value={input}
            onChange={setInput}
            onSend={handleSend}
            isLoading={isSending}
            placeholder={`Ask ${selectedModel.name} anything...`}
            onAttachFile={async () => {
              // Trigger file input
              const input = document.createElement('input');
              input.type = 'file';
              input.multiple = true;
              input.accept = '.pdf,.docx,.txt,.csv,.md,.png,.jpg,.jpeg,.gif';
              input.onchange = async (e) => {
                const files = Array.from((e.target as HTMLInputElement).files || []);
                
                for (const file of files) {
                  try {
                    // Upload file to backend first
                    const formData = new FormData();
                    formData.append('file', file);
                    
                    const response = await fetch('http://localhost:3000/api/files/upload', {
                      method: 'POST',
                      body: formData,
                    });
                    
                    if (!response.ok) {
                      throw new Error(`Upload failed: ${response.statusText}`);
                    }
                    
                    const result = await response.json();
                    
                    // Create attachment with uploaded file info
                    const attachment: Attachment = {
                      id: result.fileId,
                      name: file.name,
                      type: file.type.startsWith('image/') ? 'image' : 'file',
                      size: file.size,
                      url: result.url || `/api/files/${result.fileId}/download`,
                      mimeType: file.type,
                    };
                    
                    setAttachments(prev => [...prev, attachment]);
                  } catch (error) {
                    console.error('Failed to upload file:', error);
                    // You could show an error message to the user here
                  }
                }
              };
              input.click();
            }}
            onRAGContext={() => setShowRAGSelector(!showRAGSelector)}
            hasAttachments={attachments.length > 0}
            hasRAGContext={selectedRAGDocuments.length > 0}
          />
          
          {/* Quick Actions - Simplified */}
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2">
              {/* Only show if needed */}
              {selectedRAGDocuments.length > 0 && (
                <div className="flex items-center gap-1 text-xs text-joa-primary">
                  <Database className="w-3.5 h-3.5" />
                  <span>{selectedRAGDocuments.length} docs</span>
                </div>
              )}
            </div>
            
            <span className="text-xs text-gray-400">Press ⏎ to send</span>
          </div>
        </div>
      </div>

    </div>
  );
}

