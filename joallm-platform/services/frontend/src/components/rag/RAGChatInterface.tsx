import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Send, Bot, User, RotateCcw, Trash2, FileText, Copy, CheckCircle, MessageSquare, Sparkles, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useRAGChat } from '../../hooks/useRAGChat';
import { useRAGSuggestions } from '../../hooks/useRAGSuggestions';
import { RAGChatMessage, RAGChatSource, RAGModeId } from '../../services/ragChatApi';
import { useLLM } from '../../contexts/LLMContext';
import { RAGModeSelector } from './RAGModeSelector';
import { KnowledgeDocument } from '../../domain/knowledge';

const MODE_STYLES: Record<RAGModeId, {
  label: string;
  userBubble: string;
  aiBubble: string;
  inputRing: string;
  badge: string;
  dot: string;
}> = {
  standard: {
    label: 'Standard',
    userBubble: 'bg-gradient-to-r from-joa-primary to-teal-600 text-white',
    aiBubble: 'bg-white/90 backdrop-blur-sm border border-blue-200/60',
    inputRing: 'focus:ring-joa-primary/50 focus:border-joa-primary',
    badge: 'bg-blue-100 text-blue-700',
    dot: 'bg-blue-500',
  },
  research: {
    label: 'Research',
    userBubble: 'bg-gradient-to-r from-purple-600 to-violet-700 text-white',
    aiBubble: 'bg-purple-50/90 backdrop-blur-sm border border-purple-200/60',
    inputRing: 'focus:ring-purple-500/50 focus:border-purple-500',
    badge: 'bg-purple-100 text-purple-700',
    dot: 'bg-purple-500',
  },
  compliance: {
    label: 'Compliance',
    userBubble: 'bg-gradient-to-r from-amber-500 to-orange-600 text-white',
    aiBubble: 'bg-amber-50/90 backdrop-blur-sm border border-amber-200/60',
    inputRing: 'focus:ring-amber-500/50 focus:border-amber-500',
    badge: 'bg-amber-100 text-amber-700',
    dot: 'bg-amber-500',
  },
  decision: {
    label: 'Decision',
    userBubble: 'bg-gradient-to-r from-emerald-500 to-green-600 text-white',
    aiBubble: 'bg-emerald-50/90 backdrop-blur-sm border border-emerald-200/60',
    inputRing: 'focus:ring-emerald-500/50 focus:border-emerald-500',
    badge: 'bg-emerald-100 text-emerald-700',
    dot: 'bg-emerald-500',
  },
};

// Mirrors the retrieval parameters in backend/src/services/rag-modes.ts.
// Update here when mode configs change on the backend.
const MODE_RETRIEVAL_DISPLAY: Record<string, {
  vectorWeight: number;   // percentage, e.g. 70
  keywordWeight: number;  // percentage, e.g. 30
  threshold: number;      // minimum score as percentage, e.g. 20
  maxSources: number;     // maximum chunks retrieved (incl. second pass for research)
  multiHop: boolean;
}> = {
  standard:   { vectorWeight: 70, keywordWeight: 30, threshold: 20, maxSources: 5,  multiHop: false },
  research:   { vectorWeight: 60, keywordWeight: 40, threshold: 10, maxSources: 25, multiHop: true  },
  compliance: { vectorWeight: 50, keywordWeight: 50, threshold: 45, maxSources: 10, multiHop: false },
  decision:   { vectorWeight: 65, keywordWeight: 35, threshold: 15, maxSources: 20, multiHop: false },
};

interface RAGChatInterfaceProps {
  className?: string;
  documentIds?: string[];
  documents?: KnowledgeDocument[];
}

export function RAGChatInterface({ className = '', documentIds, documents = [] }: RAGChatInterfaceProps) {
  const [inputMessage, setInputMessage] = useState('');
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState<RAGModeId>('standard');
  const [activeSource, setActiveSource] = useState<{ source: RAGChatSource; index: number } | null>(null);
  const [copiedSourceId, setCopiedSourceId] = useState<string | null>(null);
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { selectedModel } = useLLM();
  const { messages, sendMessage, clearConversation, retryLastMessage, isChatting } = useRAGChat(selectedModel?.id, activeMode);
  const { questions, isLoading: loadingSuggestions, totalDocuments } = useRAGSuggestions(documentIds, 3);
  const documentBrief = useMemo(() => buildDocumentBrief(documents), [documents]);
  const creativePrompts = useMemo(
    () => buildCreativePrompts(documentBrief.topic, documentBrief.description, activeMode),
    [activeMode, documentBrief.description, documentBrief.topic]
  );

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isChatting) return;

    const message = inputMessage.trim();
    setInputMessage('');
    
    await sendMessage(message, documentIds);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const copyToClipboard = async (text: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const copySourceChunk = async (source: RAGChatSource) => {
    try {
      await navigator.clipboard.writeText(source.content);
      setCopiedSourceId(source.id);
      setTimeout(() => setCopiedSourceId(null), 1500);
    } catch (error) {
      console.error('Failed to copy source chunk:', error);
    }
  };

  const preserveAssistantSpacing = (text: string) => {
    const normalized = text.replace(/\r\n/g, '\n');
    const segments = normalized.split(/(```[\s\S]*?```)/g);

    return segments
      .map((segment) => {
        if (segment.startsWith('```') && segment.endsWith('```')) {
          return segment;
        }

        return segment.replace(/(?<!\n)\n(?!\n)/g, '  \n');
      })
      .join('');
  };

  const markdownComponents = {
    h1: ({ children }: any) => (
      <h1 className="mb-4 mt-6 text-xl font-bold text-gray-900 first:mt-0">{children}</h1>
    ),
    h2: ({ children }: any) => (
      <h2 className="mb-3 mt-5 text-lg font-semibold text-gray-900 first:mt-0">{children}</h2>
    ),
    h3: ({ children }: any) => (
      <h3 className="mb-2 mt-4 text-base font-semibold text-gray-900 first:mt-0">{children}</h3>
    ),
    h4: ({ children }: any) => (
      <h4 className="mb-2 mt-3 text-sm font-semibold text-gray-900 first:mt-0">{children}</h4>
    ),
    p: ({ children }: any) => (
      <p className="mb-4 whitespace-pre-wrap text-gray-900 leading-7 last:mb-0">{children}</p>
    ),
    ul: ({ children }: any) => (
      <ul className="mb-4 space-y-2 pl-0 last:mb-0">{children}</ul>
    ),
    ol: ({ children }: any) => (
      <ol className="mb-4 list-decimal space-y-2 pl-6 marker:font-semibold marker:text-joa-primary last:mb-0">{children}</ol>
    ),
    li: ({ children }: any) => (
      <li className="ml-5 whitespace-pre-wrap pl-1 text-gray-900 leading-7 marker:text-joa-primary">{children}</li>
    ),
    strong: ({ children }: any) => (
      <strong className="font-semibold text-gray-900">{children}</strong>
    ),
    em: ({ children }: any) => (
      <em className="italic text-gray-800">{children}</em>
    ),
    code: ({ inline, children, className, ...props }: any) =>
      inline ? (
        <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-sm text-gray-800" {...props}>
          {children}
        </code>
      ) : (
        <code className={className} {...props}>
          {children}
        </code>
      ),
    pre: ({ children }: any) => (
      <pre className="mb-4 overflow-x-auto rounded-xl bg-gray-900 p-4 text-sm text-gray-100 shadow-sm last:mb-0">
        {children}
      </pre>
    ),
    blockquote: ({ children }: any) => (
      <blockquote className="mb-4 border-l-4 border-joa-primary/70 bg-blue-50 py-1 pl-4 italic text-gray-800 whitespace-pre-wrap last:mb-0">
        {children}
      </blockquote>
    ),
  };

  const formatResponse = (response: string) => {
    return (
      <div className="prose prose-sm max-w-none prose-headings:font-semibold prose-headings:text-gray-900 prose-strong:text-gray-900 prose-strong:font-semibold">
        <ReactMarkdown components={markdownComponents}>
          {preserveAssistantSpacing(response)}
        </ReactMarkdown>
      </div>
    );
  };

  const formatSources = (sources: RAGChatSource[], mode: string = 'standard', messageId: string) => {
    if (!sources || sources.length === 0) return null;

    const retrieval = MODE_RETRIEVAL_DISPLAY[mode] ?? MODE_RETRIEVAL_DISPLAY.standard;
    const isExpanded = expandedSources.has(messageId);

    const toggleSources = () => {
      setExpandedSources(prev => {
        const next = new Set(prev);
        if (next.has(messageId)) {
          next.delete(messageId);
        } else {
          next.add(messageId);
        }
        return next;
      });
    };

    const getScoreColor = (score: number) => {
      const margin = score - retrieval.threshold / 100;
      if (margin >= 0.4) return 'text-green-700 bg-green-50 border border-green-200';
      if (margin >= 0.2) return 'text-yellow-700 bg-yellow-50 border border-yellow-200';
      return 'text-gray-500 bg-gray-50 border border-gray-200';
    };

    return (
      <div className="mt-3 border-t border-gray-200/60 pt-3">
        <button
          onClick={toggleSources}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
        >
          <FileText className="w-3.5 h-3.5" />
          <span>{sources.length} source{sources.length !== 1 ? 's' : ''}</span>
          <span className="text-gray-400">{isExpanded ? '▲' : '▼'}</span>
        </button>

        {isExpanded && (
          <div className="mt-2 space-y-2">
            {sources.map((source, index) => (
              <div key={source.id} className="rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-xs">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-medium text-gray-800 truncate mr-2">{source.filename}</span>
                  <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-xs font-medium ${getScoreColor(source.score)}`}>
                    {(source.score * 100).toFixed(0)}%
                  </span>
                </div>
                <p className="text-gray-600 leading-relaxed line-clamp-2">
                  {source.content.substring(0, 180)}{source.content.length > 180 ? '…' : ''}
                </p>
                <div className="mt-1.5 flex items-center gap-3">
                  <button onClick={() => setActiveSource({ source, index })} className="text-blue-600 hover:text-blue-800">
                    View chunk
                  </button>
                  <button onClick={() => copySourceChunk(source)} className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800">
                    {copiedSourceId === source.id ? <CheckCircle className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copiedSourceId === source.id ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const handlePromptSelection = (prompt: string) => {
    setInputMessage(prompt);
    inputRef.current?.focus();
  };

  const renderMessage = (message: RAGChatMessage, index: number) => {
    const isUser = message.message && !message.response;
    const isAI = message.response && !message.message;

    if (!isUser && !isAI) return null;

    const messageMode = message.mode || activeMode;
    const modeStyle = MODE_STYLES[messageMode] || MODE_STYLES.standard;

    return (
      <div key={message.id} className={`flex gap-4 ${isUser ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}>
        {!isUser && (
          <div className="w-10 h-10 bg-gradient-to-r from-joa-primary via-teal-600 to-joa-accent rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
            <Bot className="w-5 h-5 text-white" />
          </div>
        )}

        <div className={`max-w-[85%] ${isUser ? 'order-first' : ''}`}>
          <div className={`p-4 rounded-2xl shadow-sm ${isUser ? modeStyle.userBubble : 'bg-white border border-gray-200'}`}>
            {isUser && (
              <div className="flex items-center gap-2 mb-2">
                <User className="w-3.5 h-3.5 opacity-80" />
                <span className="text-xs font-medium opacity-80">You</span>
              </div>
            )}

            <div className={`text-sm leading-relaxed ${isUser ? 'text-white' : 'text-gray-900'}`}>
              {isUser ? (
                <div className="whitespace-pre-wrap">{message.message}</div>
              ) : (
                <div className="prose prose-sm max-w-none">
                  {formatResponse(message.response)}
                </div>
              )}
            </div>

            {isAI && formatSources(message.sources, messageMode, message.id)}

            <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-200/20">
              <span className={`text-xs ${isUser ? 'text-white/70' : 'text-gray-500'}`}>
                {new Date(message.timestamp).toLocaleTimeString()}
              </span>

              <button
                onClick={() => copyToClipboard(
                  isUser ? message.message : message.response,
                  message.id
                )}
                className={`p-2 rounded-lg transition-all duration-200 ${
                  isUser
                    ? 'hover:bg-white/20 text-white/70 hover:text-white'
                    : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
                }`}
                title="Copy message"
              >
                {copiedMessageId === message.id ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>

        {isUser && (
          <div className="w-10 h-10 bg-gradient-to-r from-gray-200 to-gray-300 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
            <User className="w-5 h-5 text-gray-600" />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`relative flex flex-col h-full min-h-0 bg-gradient-to-br from-white via-blue-50/30 to-indigo-50/50 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-gradient-to-r from-joa-primary to-teal-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-semibold text-gray-900">Knowledge Assistant</span>
          <RAGModeSelector selected={activeMode} onChange={setActiveMode} compact />
        </div>

        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={retryLastMessage}
              disabled={isChatting}
              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
              title="Retry last message"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={clearConversation}
            className="p-1.5 text-gray-400 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition-colors"
            title="Clear conversation"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 min-h-0">
        {messages.length === 0 ? (
          <div className="text-center py-16">
            <div className="relative mb-8">
              <div className="w-20 h-20 bg-gradient-to-r from-joa-primary via-teal-600 to-joa-accent rounded-2xl flex items-center justify-center mx-auto shadow-xl">
                <Bot className="w-10 h-10 text-white" />
              </div>
              <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full border-4 border-white animate-pulse"></div>
            </div>
            <h4 className="text-2xl font-bold text-gray-900 mb-3">Start a conversation</h4>
            <p className="text-gray-600 mb-6 text-lg">Ask questions about your knowledge base documents</p>

            <div className="mx-auto mb-8 max-w-3xl rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-6 text-left shadow-sm">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
                <FileText className="h-3.5 w-3.5" />
                Current focus
              </div>
              <h5 className="mt-3 text-xl font-semibold text-gray-900">{documentBrief.topic}</h5>
              <p className="mt-2 text-sm leading-6 text-gray-600">{documentBrief.description}</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {creativePrompts.map((prompt) => (
                  <button
                    key={prompt.label}
                    onClick={() => handlePromptSelection(prompt.prompt)}
                    className="rounded-2xl border border-white bg-white/90 px-4 py-4 text-left shadow-sm transition hover:border-joa-primary/30 hover:shadow-md"
                  >
                    <div className="text-sm font-semibold text-gray-900">{prompt.label}</div>
                    <div className="mt-1 text-xs leading-5 text-gray-600">{prompt.hint}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Mode selector — full cards in empty state */}
            <div className="max-w-2xl mx-auto mb-8">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Choose retrieval mode</p>
              <RAGModeSelector selected={activeMode} onChange={setActiveMode} />
            </div>

            <div className="space-y-4 max-w-lg mx-auto">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-joa-primary" />
                  {loadingSuggestions ? 'Loading suggestions...' : 'Suggested questions based on your documents'}
                </p>
                {totalDocuments > 0 && (
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                    {totalDocuments} docs
                  </span>
                )}
              </div>
              
              {loadingSuggestions ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="p-4 bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200/50 animate-pulse">
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-3 bg-gray-100 rounded w-1/2 mt-2"></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {questions.map((q, index) => (
                    <div
                      key={index}
                      className="p-4 bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200/50 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer hover:border-joa-primary/30 group"
                      onClick={() => setInputMessage(q.question)}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-2xl flex-shrink-0 group-hover:scale-110 transition-transform">
                          {q.icon}
                        </span>
                        <div className="flex-1">
                          <span className="text-gray-800 font-medium block mb-1">
                            "{q.question}"
                          </span>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-joa-primary font-medium">{q.category}</span>
                            <span className="text-gray-400">•</span>
                            <span className="text-gray-500">{q.relevance}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          messages.map((message, index) => renderMessage(message, index))
        )}
        
        {isChatting && (
          <div className="flex gap-4 justify-start animate-in slide-in-from-bottom-2 duration-300">
            <div className="w-10 h-10 bg-gradient-to-r from-joa-primary via-teal-600 to-joa-accent rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div className="rounded-2xl p-4 bg-white border border-gray-200 shadow-sm flex items-center gap-3 text-gray-600">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-joa-primary rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-joa-primary rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                <div className="w-2 h-2 bg-joa-primary rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
              </div>
              <span className="text-sm">Searching knowledge base…</span>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {activeSource && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <h4 className="text-sm font-semibold text-gray-900">
                  Source {activeSource.index + 1}: {activeSource.source.filename}
                </h4>
                <p className="text-xs text-gray-500">
                  Chunk {activeSource.source.chunkIndex} • {(activeSource.source.score * 100).toFixed(0)}% relevant
                </p>
              </div>
              <button
                onClick={() => setActiveSource(null)}
                className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
                title="Close source viewer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[65vh] overflow-y-auto px-5 py-4">
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-blue-700">
                Full retrieved chunk
              </p>
              <pre className="whitespace-pre-wrap rounded-xl border border-blue-100 bg-blue-50/60 p-4 text-sm leading-6 text-gray-800">
                {activeSource.source.content}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="flex-shrink-0 px-4 py-3 bg-white border-t border-gray-200">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask a question about your knowledge base..."
              className={`w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 resize-none min-h-[48px] max-h-32 bg-white text-sm transition-all duration-200 ${MODE_STYLES[activeMode].inputRing}`}
              rows={1}
              disabled={isChatting}
            />
            <div className="absolute right-3 top-3 text-gray-400">
              <MessageSquare className="w-4 h-4" />
            </div>
          </div>
          <button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || isChatting}
            className="px-5 py-3 bg-gradient-to-r from-joa-primary to-teal-600 hover:from-teal-600 hover:to-teal-800 text-white rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm font-medium"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline text-sm">Send</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function buildDocumentBrief(documents: KnowledgeDocument[]): { topic: string; description: string } {
  if (!documents.length) {
    return {
      topic: 'Your ready knowledge base',
      description: 'Select one or more ready documents to generate a sharper brief, then use the prompt actions to summarize, compare, extract decisions, or turn the material into a working draft.',
    };
  }

  const meaningfulTokens = new Set([
    'the', 'and', 'for', 'with', 'from', 'into', 'that', 'this', 'doc', 'docs', 'document', 'documents',
    'file', 'files', 'final', 'draft', 'copy', 'version', 'v1', 'v2', 'pdf', 'docx', 'md', 'txt'
  ]);

  const tokenize = (value: string) =>
    value
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 2 && !meaningfulTokens.has(token));

  const keywordCounts = new Map<string, number>();
  const metadataDescriptions: string[] = [];
  const names = documents.map((doc) => doc.displayName);

  for (const doc of documents) {
    const description = typeof doc.backend.metadata?.description === 'string' ? doc.backend.metadata.description : '';
    if (description) {
      metadataDescriptions.push(description);
    }

    for (const token of tokenize(`${doc.displayName} ${description}`)) {
      keywordCounts.set(token, (keywordCounts.get(token) || 0) + 1);
    }
  }

  const topKeywords = [...keywordCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([token]) => token);

  const topic = topKeywords.length > 0
    ? `A working set about ${topKeywords.map(toTitleCase).join(', ')}`
    : documents.length === 1
      ? `Focused work around ${stripExtension(names[0])}`
      : `${documents.length} selected documents ready for grounded work`;

  const fileTypes = [...new Set(documents.map((doc) => (doc.mimeType || 'document').split('/').pop() || 'document'))];
  const exampleNames = names.slice(0, 2).map(stripExtension);
  const topicSentence = metadataDescriptions[0]
    ? metadataDescriptions[0]
    : exampleNames.length === 1
      ? `The current selection is centered on ${exampleNames[0]}.`
      : `The current selection blends ${exampleNames.join(' and ')} into one grounded working set.`;

  const description = `${topicSentence} You currently have ${documents.length} selected ${documents.length === 1 ? 'document' : 'documents'} across ${fileTypes.length} ${fileTypes.length === 1 ? 'format' : 'formats'}. Use this set to summarize, compare, extract obligations, generate FAQs, or turn the material into a reusable brief.`;

  return { topic, description };
}

function buildCreativePrompts(
  topic: string,
  description: string,
  mode: RAGModeId
): Array<{ label: string; hint: string; prompt: string }> {
  const modeHint =
    mode === 'research'
      ? 'Prioritize nuance, open questions, and conflicting evidence.'
      : mode === 'compliance'
        ? 'Focus on obligations, risks, controls, and exact supporting evidence.'
        : mode === 'decision'
          ? 'Focus on tradeoffs, recommendations, and next actions.'
          : 'Keep the answer grounded, readable, and source-backed.';

  return [
    {
      label: 'Executive Brief',
      hint: 'Turn the current document set into a concise leadership-ready summary.',
      prompt: `Create an executive brief for this knowledge set.\n\nTopic: ${topic}\nDocument description: ${description}\n\nPlease give me:\n1. The main theme\n2. The most important facts\n3. Risks or unresolved questions\n4. A short recommendation\n\n${modeHint}`,
    },
    {
      label: 'Teach Me Fast',
      hint: 'Explain the documents like I am onboarding into this topic today.',
      prompt: `Teach me this document set quickly.\n\nTopic: ${topic}\nDocument description: ${description}\n\nExplain:\n1. What this material is about\n2. The key concepts I should understand first\n3. Important terminology\n4. What I should read or ask next\n\n${modeHint}`,
    },
    {
      label: 'Decision Lens',
      hint: 'Pull out decisions, tradeoffs, assumptions, and next-step advice.',
      prompt: `Review this knowledge set through a decision-making lens.\n\nTopic: ${topic}\nDocument description: ${description}\n\nPlease extract:\n1. Decisions already implied by the documents\n2. Tradeoffs or tensions\n3. Missing information needed for a strong decision\n4. Recommended next actions\n\n${modeHint}`,
    },
    {
      label: 'FAQ Builder',
      hint: 'Create practical question-and-answer pairs from the selected material.',
      prompt: `Create a useful FAQ from this document set.\n\nTopic: ${topic}\nDocument description: ${description}\n\nBuild 8 practical questions and grounded answers that someone working with these documents would actually ask.\n\n${modeHint}`,
    },
  ];
}

function stripExtension(value: string): string {
  return value.replace(/\.[a-z0-9]+$/i, '');
}

function toTitleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
