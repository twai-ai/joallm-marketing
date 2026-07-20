import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Trash2, Search, Plus, MoreVertical, Archive } from 'lucide-react';
import { ChatSession } from '../../types';

interface ConversationHistoryProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onNewChat: () => void;
}

export function ConversationHistory({
  sessions,
  activeSessionId,
  onSelectSession,
  onDeleteSession,
  onNewChat,
}: ConversationHistoryProps) {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  const handleSelectSession = (sessionId: string) => {
    onSelectSession(sessionId);
    navigate(`/chat/${sessionId}`);
  };

  const filteredSessions = sessions.filter((session) =>
    session.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (date: Date) => {
    try {
      const d = new Date(date);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return 'Recent';
    }
  };

  return (
    <div className="w-72 xl:w-80 2xl:w-[22rem] border-r border-gray-200 bg-white flex flex-col h-full flex-shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-joa-primary hover:bg-teal-800 text-white rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span className="font-medium">New Chat</span>
        </button>
      </div>

      {/* Search */}
      <div className="p-3 border-b border-gray-200">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-joa-primary focus:border-joa-primary"
          />
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        {filteredSessions.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            {searchTerm ? 'No conversations found' : 'No conversations yet'}
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {filteredSessions.map((session) => (
              <div
                key={session.id}
                onClick={() => handleSelectSession(session.id)}
                className={`group relative flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                  activeSessionId === session.id
                    ? 'bg-red-50 border border-red-200'
                    : 'hover:bg-gray-50'
                }`}
              >
                <MessageSquare
                  className={`w-4 h-4 flex-shrink-0 ${
                    activeSessionId === session.id ? 'text-joa-primary' : 'text-gray-400'
                  }`}
                />
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3
                      className={`text-sm font-medium truncate ${
                        activeSessionId === session.id ? 'text-red-900' : 'text-gray-900'
                      }`}
                    >
                      {session.title}
                    </h3>
                  </div>
                  
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-500">
                      {formatDate(session.updatedAt)}
                    </span>
                    {session.messageCount > 0 && (
                      <>
                        <span className="text-xs text-gray-400">•</span>
                        <span className="text-xs text-gray-500">
                          {session.messageCount} messages
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Action Menu */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm('Are you sure you want to delete this conversation?')) {
                        onDeleteSession(session.id);
                      }
                    }}
                    className="p-1 hover:bg-teal-50 rounded transition-colors"
                    title="Delete conversation"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
