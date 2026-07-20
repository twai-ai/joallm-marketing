import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, RotateCcw, Trash2, FileText, Copy, CheckCircle, AlertCircle, MessageSquare, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useRAGChat } from '../../hooks/useRAGChat';
import { RAGChatMessage, RAGChatSource } from '../../services/ragChatApi';
import { useLLM } from '../../contexts/LLMContext';

interface RAGChatInterfaceProps {
  className?: string;
  documentIds?: string[];
}

export function RAGChatInterface({ className = '', documentIds }: RAGChatInterfaceProps) {
  const [inputMessage, setInputMessage] = useState('');
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [copiedSourceId, setCopiedSourceId] = useState<string | null>(null);
  const [activeSource, setActiveSource] = useState<{ source: RAGChatSource; index: number } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { selectedModel } = useLLM();
  const { messages, sendMessage, clearConversation, retryLastMessage, isChatting } = useRAGChat(selectedModel?.id);

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

  // Function to clean markdown syntax from text
  const cleanMarkdown = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold markdown
      .replace(/\*(.*?)\*/g, '$1') // Remove italic markdown
      .replace(/__(.*?)__/g, '$1') // Remove bold underscore
      .replace(/_(.*?)_/g, '$1') // Remove italic underscore
      .replace(/`(.*?)`/g, '$1') // Remove inline code
      .replace(/```[\s\S]*?```/g, '') // Remove code blocks
      .replace(/^#{1,6}\s+/gm, '') // Remove headers
      .replace(/^\s*[-*+]\s+/gm, '• ') // Convert list items to bullet points
      .replace(/^\s*\d+\.\s+/gm, (match) => match) // Keep numbered lists
      .replace(/\*\s+/g, '• ') // Convert remaining asterisks to bullet points
      .trim();
  };

  const formatResponse = (response: string) => {
    // First clean any markdown syntax
    const cleanedResponse = cleanMarkdown(response);
    
    return (
      <div className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-headings:font-semibold prose-p:text-gray-700 prose-p:leading-relaxed prose-strong:text-gray-900 prose-strong:font-semibold prose-ul:text-gray-700 prose-ol:text-gray-700 prose-li:text-gray-700 prose-li:leading-relaxed">
        <ReactMarkdown
          components={{
            // Custom styling for different markdown elements
            h1: ({ children }) => (
              <h1 className="text-xl font-bold text-gray-900 mb-4 mt-6 first:mt-0">{children}</h1>
            ),
            h2: ({ children }) => (
              <h2 className="text-lg font-semibold text-gray-900 mb-3 mt-5 first:mt-0">{children}</h2>
            ),
            h3: ({ children }) => (
              <h3 className="text-base font-semibold text-gray-900 mb-2 mt-4 first:mt-0">{children}</h3>
            ),
            h4: ({ children }) => (
              <h4 className="text-sm font-semibold text-gray-900 mb-2 mt-3 first:mt-0">{children}</h4>
            ),
            p: ({ children }) => (
              <p className="text-gray-700 leading-relaxed mb-4 last:mb-0">{children}</p>
            ),
            ul: ({ children }) => (
              <ul className="list-none space-y-2 mb-4 last:mb-0">{children}</ul>
            ),
            ol: ({ children }) => (
              <ol className="list-none space-y-2 mb-4 last:mb-0">{children}</ol>
            ),
            li: ({ children, ordered }) => (
              <li className="flex items-start gap-3">
                {ordered ? (
                  <div className="w-6 h-6 bg-joa-primary text-white text-xs font-bold rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    {children?.toString().match(/^\d+/)?.[0] || '•'}
                  </div>
                ) : (
                  <div className="w-2 h-2 bg-joa-primary rounded-full flex-shrink-0 mt-2"></div>
                )}
                <div className="text-gray-700 leading-relaxed flex-1">
                  {ordered ? children?.toString().replace(/^\d+\.\s/, '') : children}
                </div>
              </li>
            ),
            strong: ({ children }) => (
              <strong className="font-semibold text-gray-900">{children}</strong>
            ),
            em: ({ children }) => (
              <em className="italic text-gray-600">{children}</em>
            ),
            code: ({ children }) => (
              <code className="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded text-sm font-mono">
                {children}
              </code>
            ),
            pre: ({ children }) => (
              <pre className="bg-gray-100 text-gray-800 p-3 rounded-lg overflow-x-auto text-sm font-mono mb-4 last:mb-0">
                {children}
              </pre>
            ),
            blockquote: ({ children }) => (
              <blockquote className="border-l-4 border-joa-primary pl-4 italic text-gray-600 mb-4 last:mb-0">
                {children}
              </blockquote>
            ),
          }}
        >
          {cleanedResponse}
        </ReactMarkdown>
      </div>
    );
  };

  const formatSources = (sources: RAGChatSource[]) => {
    if (!sources || sources.length === 0) return null;

    return (
      <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/50 rounded-xl shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
            <FileText className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <span className="text-sm font-semibold text-blue-900">Knowledge Sources</span>
            <p className="text-xs text-blue-600">Based on {sources.length} document{sources.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="space-y-3">
          {sources.map((source, index) => (
            <div key={source.id} className="bg-white/80 backdrop-blur-sm p-3 rounded-lg border border-blue-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-blue-100 text-blue-700 text-xs font-bold rounded-full flex items-center justify-center flex-shrink-0">
                    {index + 1}
                  </div>
                  <span className="font-medium text-blue-900 text-sm">
                    {source.filename}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-xs font-medium text-green-700">
                    {(source.score * 100).toFixed(0)}% relevant
                  </span>
                </div>
              </div>
              <div className="text-xs text-gray-600 leading-relaxed bg-gray-50 p-2 rounded border-l-2 border-blue-200">
                "{source.content.substring(0, 160)}{source.content.length > 160 ? '...' : ''}"
              </div>
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={() => setActiveSource({ source, index })}
                  className="text-xs font-medium text-blue-700 hover:text-blue-900"
                >
                  View full chunk
                </button>
                <button
                  onClick={() => copySourceChunk(source)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-900"
                >
                  {copiedSourceId === source.id ? <CheckCircle className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedSourceId === source.id ? 'Copied' : 'Copy chunk'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderMessage = (message: RAGChatMessage, index: number) => {
    const isUser = message.message && !message.response;
    const isAI = message.response && !message.message;

    if (!isUser && !isAI) return null;

    return (
      <div key={message.id} className={`flex gap-4 ${isUser ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}>
        {!isUser && (
          <div className="w-10 h-10 bg-gradient-to-r from-joa-primary via-red-600 to-joa-accent rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
            <Bot className="w-5 h-5 text-white" />
          </div>
        )}
        
        <div className={`max-w-[85%] ${isUser ? 'order-first' : ''}`}>
          <div className={`p-5 rounded-2xl shadow-lg ${
            isUser 
              ? 'bg-gradient-to-r from-joa-primary to-red-600 text-white' 
              : 'bg-white/90 backdrop-blur-sm border border-gray-200/50'
          }`}>
            {isUser ? (
              <div className="flex items-center gap-2 mb-3">
                <User className="w-4 h-4" />
                <span className="font-semibold">You</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 mb-3">
                <Bot className="w-4 h-4 text-joa-primary" />
                <span className="font-semibold text-gray-900">Knowledge Base Assistant</span>
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              </div>
            )}
            
            <div className={`text-sm leading-relaxed ${isUser ? 'text-white' : 'text-gray-700'}`}>
              {isUser ? (
                <div className="whitespace-pre-wrap">{message.message}</div>
              ) : (
                <div className="prose prose-sm max-w-none">
                  {formatResponse(message.response)}
                </div>
              )}
            </div>

            {isAI && formatSources(message.sources)}

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
    <div className={`relative flex flex-col h-full bg-gradient-to-br from-white via-blue-50/30 to-indigo-50/50 ${className}`}>
      {/* Enhanced Chat Header */}
      <div className="flex items-center justify-between p-6 bg-white/80 backdrop-blur-sm border-b border-gray-200/50 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 bg-gradient-to-r from-joa-primary via-red-600 to-joa-accent rounded-xl flex items-center justify-center shadow-lg">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white animate-pulse"></div>
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">Knowledge Base Assistant</h3>
            <p className="text-sm text-gray-600 mt-1">💬 Ask questions about your documents</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {messages.length > 0 && (
            <button
              onClick={retryLastMessage}
              disabled={isChatting}
              className="p-3 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all duration-200 disabled:opacity-50 shadow-sm hover:shadow-md"
              title="Retry last message"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
          )}
          
          <button
            onClick={clearConversation}
            className="p-3 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md"
            title="Clear conversation"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.length === 0 ? (
          <div className="text-center py-16">
            <div className="relative mb-8">
              <div className="w-20 h-20 bg-gradient-to-r from-joa-primary via-red-600 to-joa-accent rounded-2xl flex items-center justify-center mx-auto shadow-xl">
                <Bot className="w-10 h-10 text-white" />
              </div>
              <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full border-4 border-white animate-pulse"></div>
            </div>
            <h4 className="text-2xl font-bold text-gray-900 mb-3">Start a conversation</h4>
            <p className="text-gray-600 mb-8 text-lg">Ask questions about your knowledge base documents</p>
            
            <div className="space-y-4 max-w-lg mx-auto">
              <p className="text-sm font-semibold text-gray-700 uppercase tracking-wide">💡 Try asking:</p>
              <div className="space-y-3">
                <div className="p-4 bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200/50 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer hover:border-joa-primary/30" onClick={() => setInputMessage("What are the main features of JoaLLM?")}>
                  <span className="text-gray-800 font-medium">"What are the main features of JoaLLM?"</span>
                </div>
                <div className="p-4 bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200/50 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer hover:border-joa-primary/30" onClick={() => setInputMessage("How do I upload documents?")}>
                  <span className="text-gray-800 font-medium">"How do I upload documents?"</span>
                </div>
                <div className="p-4 bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200/50 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer hover:border-joa-primary/30" onClick={() => setInputMessage("What is RAG and how does it work?")}>
                  <span className="text-gray-800 font-medium">"What is RAG and how does it work?"</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          messages.map((message, index) => renderMessage(message, index))
        )}
        
        {isChatting && (
          <div className="flex gap-4 justify-start animate-in slide-in-from-bottom-2 duration-300">
            <div className="w-10 h-10 bg-gradient-to-r from-joa-primary via-red-600 to-joa-accent rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div className="bg-white/90 backdrop-blur-sm border border-gray-200/50 rounded-2xl p-5 shadow-lg">
              <div className="flex items-center gap-2 mb-3">
                <Bot className="w-4 h-4 text-joa-primary" />
                <span className="font-semibold text-gray-900">Knowledge Base Assistant</span>
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              </div>
              <div className="flex items-center gap-3 text-gray-600">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-joa-primary rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-joa-primary rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                  <div className="w-2 h-2 bg-joa-primary rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                </div>
                <span className="text-sm">Searching knowledge base...</span>
              </div>
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

      {/* Enhanced Input */}
      <div className="p-6 bg-white/80 backdrop-blur-sm border-t border-gray-200/50 shadow-lg">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask a question about your knowledge base..."
              className="w-full px-4 py-3 pr-12 border border-gray-300/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-joa-primary/50 focus:border-joa-primary resize-none min-h-[52px] max-h-32 bg-white/90 backdrop-blur-sm shadow-sm transition-all duration-200"
              rows={1}
              disabled={isChatting}
            />
            <div className="absolute right-3 top-3 text-gray-400">
              <MessageSquare className="w-5 h-5" />
            </div>
          </div>
          <button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || isChatting}
            className="px-6 py-3 bg-gradient-to-r from-joa-primary to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg hover:shadow-xl font-medium"
          >
            <Send className="w-5 h-5" />
            <span className="hidden sm:inline">Send</span>
          </button>
        </div>
        
        <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
          <span>Press Enter to send, Shift+Enter for new line</span>
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            Ready to chat
          </span>
        </div>
      </div>
    </div>
  );
}
