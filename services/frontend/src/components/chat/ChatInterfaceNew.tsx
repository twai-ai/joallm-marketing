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
import { apiClient } from '../../utils/api-client';
import { API_ENDPOINTS } from '../../config/api';
import { showError, showSuccess, showInfo } from '../../utils/toast';
import { preferencesApi } from '../../services/preferencesApi';
import { useWorkflow } from '../../contexts/WorkflowContext';
import { buildWorkflowFromChatMessage } from '../workflow/workflowTemplates';
import {
  DEFAULT_MULTIMODAL_SETTINGS,
  MODALITY_CAPABILITIES,
  getProviderDisplayName,
  normalizeMultimodalSettings,
  type ModalityCapabilityId,
  type MultimodalProcessingMode,
  type MultimodalSettings,
} from '../../constants/modalities';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  const [selectedModalities, setSelectedModalities] = useState<ModalityCapabilityId[]>([]);
  const [processingMode, setProcessingMode] = useState<MultimodalProcessingMode>('analyze_directly');
  const [multimodalDefaults, setMultimodalDefaults] = useState<MultimodalSettings>(DEFAULT_MULTIMODAL_SETTINGS);
  const [nextActionSuggestion, setNextActionSuggestion] = useState<MultimodalProcessingMode | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { getRoleConfig } = useUserRole();
  const { selectedModel } = useLLM();
  const { createWorkflowFromDefinition } = useWorkflow();
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

  useEffect(() => {
    let cancelled = false;

    const loadMultimodalDefaults = async () => {
      try {
        const preferences = await preferencesApi.getPreferences();
        if (!cancelled) {
          setMultimodalDefaults(normalizeMultimodalSettings(preferences.multimodalSettings));
        }
      } catch {
        if (!cancelled) {
          setMultimodalDefaults(DEFAULT_MULTIMODAL_SETTINGS);
        }
      }
    };

    void loadMultimodalDefaults();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSelectedModalitiesChange = (nextModalities: ModalityCapabilityId[]) => {
    const addedCapability = nextModalities.find((capabilityId) => !selectedModalities.includes(capabilityId));
    setSelectedModalities(nextModalities);

    if (addedCapability && nextModalities.length === 1) {
      setProcessingMode(multimodalDefaults.routing[addedCapability].processingMode);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isSending) return;

    const selectedProcessingMode = processingMode;
    const modalityInstruction = selectedModalities.length > 0
      ? `Multimodal mode: ${selectedModalities.join(', ')}. Processing preference: ${processingMode.replace(/_/g, ' ')}.\n\n`
      : '';
    const messageContent = `${modalityInstruction}${input}`;
    const messageAttachments = attachments.map(attachment => ({
      type: attachment.type,
      name: attachment.name,
      url: attachment.url || attachment.id, // Use URL if available, otherwise use ID
    }));
    
    setInput('');
    setAttachments([]);
    setSelectedModalities([]);
    setProcessingMode('analyze_directly');

    try {
      await sendMessage(
        messageContent,
        selectedModel.id,
        messageAttachments,
        selectedRAGDocuments,
        modelParameters
      );
      setNextActionSuggestion(
        selectedProcessingMode === 'analyze_directly' ? null : selectedProcessingMode
      );
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
        await sendMessage(
          previousMessage.content,
          selectedModel.id,
          previousMessage.attachments,
          selectedRAGDocuments,
          modelParameters
        );
      }
    }
  };

  const handleDeleteMessage = (messageId: string) => {
    deleteMessage(messageId);
  };

  const handleSaveMessageToKnowledge = async (messageId: string) => {
    if (!UUID_PATTERN.test(messageId)) {
      showError('Please wait a moment while this message is being saved.');
      return;
    }

    try {
      const response = await apiClient.post<{ file: { filename: string } }>(
        API_ENDPOINTS.chat.saveMessageToKnowledge(messageId),
        {},
      );
      showSuccess(`Saved to Knowledge as ${response.file.filename}`);
      setNextActionSuggestion(null);
    } catch (error: any) {
      showError(error?.message || 'Failed to save message to Knowledge');
    }
  };

  const handleRouteMessageToWorkflow = async (messageId: string) => {
    const sourceMessage = messages.find((message) => message.id === messageId);
    if (!sourceMessage) {
      showError('Could not find the selected message');
      return;
    }

    try {
      const definition = buildWorkflowFromChatMessage(
        sourceMessage.content,
        sourceMessage.role === 'assistant' ? 'assistant' : 'user',
        sourceMessage.id,
      );
      const workflow = await createWorkflowFromDefinition(definition);
      showSuccess('Workflow created from chat message');
      navigate(`/workflow/${workflow.id}`);
    } catch (error: any) {
      showError(error?.message || 'Failed to route message to workflow');
    }
  };

  // Get active session title for export
  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const sessionTitle = activeSession?.title || 'Chat Conversation';
  const latestAssistantMessage = [...messages].reverse().find(
    (message) => message.role === 'assistant' && message.content.trim().length > 0,
  );

  return (
    <div className="flex h-full min-h-0 bg-gradient-to-br from-slate-50 via-white to-slate-50">
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
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
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
        <div className="flex-1 overflow-y-auto relative min-h-0">
          {isLoading && messages.length === 0 ? (
            <div className="workspace-shell-comfort px-0 py-6">
              <ChatMessageSkeleton />
            </div>
          ) : messages.length === 0 ? (
            <div className="workspace-shell-comfort flex h-full items-center justify-center px-0 py-6">
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
                onRouteToWorkflow={handleRouteMessageToWorkflow}
              />
              <div ref={messagesEndRef} />
            </>
          )}

          {/* Export Menu - moved to header as dropdown */}
        </div>

        {/* Input Area - Fixed at bottom */}
        <div className="flex-shrink-0 border-t border-gray-100 bg-white/95 backdrop-blur relative sticky bottom-0 z-10">
          <div className="workspace-shell-comfort px-0 py-4">
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

          {(selectedModalities.length > 0 || attachments.length > 0) && (
            <div className="mb-2 rounded-2xl border border-slate-200 bg-white/80 px-3 py-3 text-sm text-slate-700">
              <div className="flex flex-wrap items-center gap-2">
                {selectedModalities.map((id) => {
                  const capability = MODALITY_CAPABILITIES.find((item) => item.id === id);
                  if (!capability) return null;
                  const routing = multimodalDefaults.routing[id];
                  return (
                    <span key={id} className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium ${capability.accentClass}`}>
                      <capability.icon className="h-3.5 w-3.5" />
                      {capability.label}
                      <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                        {getProviderDisplayName(routing.primaryProvider)}
                      </span>
                    </span>
                  );
                })}
                {attachments.length > 0 ? (
                  <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
                    {attachments.length} attachment{attachments.length > 1 ? 's' : ''}
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-joa-primary">
                  {processingMode.replace(/_/g, ' ')}
                </span>
              </div>
            </div>
          )}

          {nextActionSuggestion && latestAssistantMessage && (
            <div className="mb-3 rounded-2xl border border-red-100 bg-white px-3 py-3 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {nextActionSuggestion === 'add_to_knowledge'
                      ? 'This reply looks like something you may want to keep.'
                      : nextActionSuggestion === 'route_to_workflow'
                        ? 'This reply is ready to become a reusable workflow handoff.'
                        : 'This extracted result can now be saved or operationalized.'}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {nextActionSuggestion === 'add_to_knowledge'
                      ? 'Save it to Knowledge so it becomes searchable later.'
                      : nextActionSuggestion === 'route_to_workflow'
                        ? 'Turn it into a workflow if you want a repeatable process from this answer.'
                        : 'Use the next action that best matches what you want to do with the structured result.'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(nextActionSuggestion === 'add_to_knowledge' || nextActionSuggestion === 'extract_first') && (
                    <button
                      onClick={() => void handleSaveMessageToKnowledge(latestAssistantMessage.id)}
                      className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-joa-primary transition hover:bg-red-100"
                    >
                      Save Latest Reply
                    </button>
                  )}
                  {(nextActionSuggestion === 'route_to_workflow' || nextActionSuggestion === 'extract_first') && (
                    <button
                      onClick={() => void handleRouteMessageToWorkflow(latestAssistantMessage.id)}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                    >
                      Route Latest Reply
                    </button>
                  )}
                  <button
                    onClick={() => setNextActionSuggestion(null)}
                    className="rounded-xl border border-transparent px-2 py-2 text-xs font-medium text-slate-400 transition hover:text-slate-600"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
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
              // Updated to only include supported formats (removed unsupported formats)
              input.accept = '.pdf,.doc,.docx,.txt,.csv,.md,.html,.xml,.rtf,.png,.jpg,.jpeg,.gif,.webp,.bmp,.json,.yaml,.yml,.mp3,.wav,.m4a,.aac,.mp4,.mov,.webm';
              input.onchange = async (e) => {
                const files = Array.from((e.target as HTMLInputElement).files || []);
                
                if (files.length === 0) return;
                
                // Show loading indicator
                showInfo(`Uploading ${files.length} file(s)...`);
                
                for (const file of files) {
                  try {
                    // Validate file size (10MB max)
                    if (file.size > 10 * 1024 * 1024) {
                      showError(`${file.name} is too large (max 10MB)`);
                      continue;
                    }
                    
                    // Upload file to backend using apiClient (fixed hardcoded URL)
                    const result = await apiClient.uploadFile<{ fileId?: string; id?: string; url?: string }>(
                      API_ENDPOINTS.files.upload,
                      file
                    );
                    
                    // Create attachment with uploaded file info
                    const attachment: Attachment = {
                      id: result.fileId || result.id || '',
                      name: file.name,
                      type: file.type.startsWith('image/') ? 'image' : 'file',
                      size: file.size,
                      url: result.url || `/api/files/${result.fileId || result.id}/download`,
                      mimeType: file.type,
                    };
                    
                    setAttachments(prev => [...prev, attachment]);
                    showSuccess(`${file.name} uploaded successfully`);
                  } catch (error: any) {
                    console.error('Failed to upload file:', error);
                    const errorMessage = error?.message || `Failed to upload ${file.name}`;
                    showError(errorMessage);
                  }
                }
              };
              input.click();
            }}
            onRAGContext={() => setShowRAGSelector(!showRAGSelector)}
            hasAttachments={attachments.length > 0}
            hasRAGContext={selectedRAGDocuments.length > 0}
            selectedModalities={selectedModalities}
            onSelectedModalitiesChange={handleSelectedModalitiesChange}
            processingMode={processingMode}
            onProcessingModeChange={setProcessingMode}
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

    </div>
  );
}
