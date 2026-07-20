import React from 'react';
import { User, Bot, RefreshCw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { MessageActions } from './MessageActions';
import type { Message } from '../../types';

interface MessageListProps {
  messages: Message[];
  onEditMessage?: (messageId: string) => void;
  onRegenerateMessage?: (messageId: string) => void;
  onDeleteMessage?: (messageId: string) => void;
}

export function MessageList({ 
  messages, 
  onEditMessage, 
  onRegenerateMessage,
  onDeleteMessage 
}: MessageListProps) {
  const formatTime = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  };

  // Safety check - ensure messages is an array
  if (!Array.isArray(messages)) {
    console.error('MessageList: messages is not an array', messages);
    return null;
  }


  return (
    <div className="space-y-6">
      {messages.map((message) => (
        <div key={message.id} className="group">
          {message.role === 'system' ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-joa-primary rounded-full flex items-center justify-center">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <div className="text-sm text-red-800">{message.content}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className={`flex items-start space-x-3 ${
              message.role === 'user' ? 'flex-row-reverse' : ''
            }`}>
              {message.role === 'assistant' && (
                <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                  <Bot className="w-5 h-5 text-gray-600" />
                </div>
              )}
              
              {message.role === 'user' && (
                <div className="w-8 h-8 bg-joa-primary rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-white" />
                </div>
              )}
              
              <div className={`max-w-2xl ${
                message.role === 'user' 
                  ? 'bg-joa-primary text-white rounded-lg px-4 py-3' 
                  : 'bg-white'
              }`}>
                {message.role === 'assistant' && (
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-xs font-medium text-gray-600">{message.model}</span>
                    <span className="text-xs text-gray-400">•</span>
                    <span className="text-xs text-gray-400">{formatTime(message.timestamp)}</span>
                    {message.isStreaming && (
                      <RefreshCw className="w-3 h-3 text-joa-primary animate-spin" />
                    )}
                  </div>
                )}
                
                <div className="message-content">
                  {message.role === 'assistant' ? (
                    <div className="prose prose-sm max-w-none prose-headings:font-semibold prose-headings:text-gray-900 prose-h1:text-xl prose-h1:mb-3 prose-h2:text-lg prose-h2:mb-2 prose-h3:text-base prose-h3:mb-2 prose-p:text-gray-700 prose-p:my-3 prose-p:leading-relaxed prose-p:text-justify prose-ul:my-3 prose-ol:my-3 prose-li:my-1 prose-li:text-gray-700 prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-pre:p-4 prose-pre:rounded-lg prose-pre:my-3 prose-code:text-sm prose-code:bg-gray-100 prose-code:text-gray-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:font-mono prose-strong:font-semibold prose-strong:text-gray-900 prose-em:italic prose-a:text-joa-primary prose-a:underline prose-a:hover:text-red-800 prose-blockquote:border-l-4 prose-blockquote:border-joa-primary prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-gray-600 prose-hr:my-4 prose-hr:border-gray-200 prose-table:my-3 prose-th:text-left prose-th:font-semibold">
                      <ReactMarkdown>{message.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap text-white leading-relaxed">{message.content}</p>
                  )}
                </div>
                
                {message.attachments && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {message.attachments.map((attachment, index) => (
                      <div
                        key={index}
                        className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-md flex items-center space-x-1"
                      >
                        <span>{attachment.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Message Actions */}
          {message.role !== 'system' && (
            <div className="mt-2">
              <MessageActions
                messageId={message.id}
                content={message.content}
                onEdit={message.role === 'user' ? onEditMessage : undefined}
                onRegenerate={message.role === 'assistant' ? onRegenerateMessage : undefined}
                onDelete={onDeleteMessage}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}