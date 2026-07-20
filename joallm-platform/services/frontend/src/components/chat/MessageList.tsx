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
  onRouteToWorkflow?: (messageId: string) => void;
}

function preserveAssistantSpacing(content: string) {
  const normalized = content.replace(/\r\n/g, '\n');
  const segments = normalized.split(/(```[\s\S]*?```)/g);

  return segments
    .map((segment) => {
      if (segment.startsWith('```') && segment.endsWith('```')) {
        return segment;
      }

      return segment.replace(/(?<!\n)\n(?!\n)/g, '  \n');
    })
    .join('');
}

const assistantMarkdownComponents = {
  p: ({ children }: any) => <p className="my-4 whitespace-pre-wrap leading-7 text-gray-700">{children}</p>,
  ul: ({ children }: any) => <ul className="my-4 space-y-2 pl-0">{children}</ul>,
  ol: ({ children }: any) => <ol className="my-4 space-y-2 pl-6 list-decimal marker:text-joa-primary marker:font-semibold">{children}</ol>,
  li: ({ children }: any) => <li className="ml-5 whitespace-pre-wrap leading-7 text-gray-700 pl-1 marker:text-joa-primary">{children}</li>,
  blockquote: ({ children }: any) => (
    <blockquote className="my-4 border-l-4 border-joa-primary/70 bg-teal-50/40 py-1 pl-4 italic text-gray-600 whitespace-pre-wrap">
      {children}
    </blockquote>
  ),
  pre: ({ children }: any) => (
    <pre className="my-4 overflow-x-auto rounded-xl bg-gray-900 p-4 text-sm text-gray-100 shadow-sm">
      {children}
    </pre>
  ),
  code: ({ inline, children, className, ...props }: any) =>
    inline ? (
      <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[0.95em] text-gray-800" {...props}>
        {children}
      </code>
    ) : (
      <code className={className} {...props}>
        {children}
      </code>
    ),
  hr: () => <hr className="my-6 border-gray-200" />,
  a: ({ children, href, ...props }: any) => (
    <a className="font-medium text-joa-primary underline underline-offset-2 hover:text-teal-800" href={href} {...props}>
      {children}
    </a>
  ),
};

export function MessageList({ 
  messages, 
  onEditMessage, 
  onRegenerateMessage,
  onDeleteMessage,
  onRouteToWorkflow,
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
    <div className="workspace-shell-comfort space-y-6 px-0">
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
              
              <div className={`w-full max-w-[72ch] xl:max-w-[78ch] ${
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
                    <div className="prose prose-sm max-w-none prose-headings:font-semibold prose-headings:text-gray-900 prose-h1:mb-4 prose-h1:text-xl prose-h2:mb-3 prose-h2:mt-6 prose-h2:text-lg prose-h3:mb-2 prose-h3:mt-5 prose-h3:text-base prose-strong:font-semibold prose-strong:text-gray-900 prose-em:italic prose-table:my-4 prose-th:text-left prose-th:font-semibold prose-td:align-top">
                      <ReactMarkdown
                        components={assistantMarkdownComponents}
                      >
                        {preserveAssistantSpacing(message.content)}
                      </ReactMarkdown>
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
                enableFeedback={message.role === 'assistant'}
                onEdit={message.role === 'user' ? onEditMessage : undefined}
                onRegenerate={message.role === 'assistant' ? onRegenerateMessage : undefined}
                onDelete={onDeleteMessage}
                onRouteToWorkflow={onRouteToWorkflow}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
