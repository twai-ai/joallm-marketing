import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Trash2, Search, Plus, Loader2, Calendar, Hash } from 'lucide-react';
import { useSessionManagement, ChatSession } from '../../hooks/useSessionManagement';
import { showSuccess, showError } from '../../utils/toast';

interface SessionListProps {
  currentSessionId?: string;
  onClose?: () => void;
}

export function SessionList({ currentSessionId, onClose }: SessionListProps) {
  const navigate = useNavigate();
  const { listSessions, deleteSession, loading } = useSessionManagement();
  
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Load sessions
  useEffect(() => {
    loadSessions();
  }, [page, searchQuery]);

  const loadSessions = async () => {
    setIsLoading(true);
    try {
      const response = await listSessions(page, 20, searchQuery || undefined);
      setSessions(response.sessions);
      setTotal(response.pagination.total);
    } catch (error) {
      console.error('Failed to load sessions:', error);
      showError('Failed to load chat sessions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectSession = (session: ChatSession) => {
    // Navigate to session using shortId
    navigate(`/chat/${session.shortId}`);
    onClose?.();
  };

  const handleDeleteSession = async (sessionId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    
    if (!confirm('Are you sure you want to delete this chat session?')) {
      return;
    }

    try {
      await deleteSession(sessionId);
      showSuccess('Session deleted successfully');
      loadSessions(); // Reload the list
    } catch (error) {
      console.error('Failed to delete session:', error);
      showError('Failed to delete session');
    }
  };

  const handleNewChat = () => {
    navigate('/chat');
    onClose?.();
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setPage(1); // Reset to first page on search
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">Chat History</h2>
          <button
            onClick={handleNewChat}
            className="flex items-center gap-2 px-3 py-1.5 bg-joa-primary text-white rounded-lg hover:bg-joa-primary-dark transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </button>
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search conversations..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-joa-primary focus:border-transparent text-sm"
          />
        </div>

        {/* Stats */}
        <div className="mt-2 text-xs text-gray-500">
          {total} conversation{total !== 1 ? 's' : ''} total
        </div>
      </div>

      {/* Session List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-6 h-6 animate-spin text-joa-primary" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-500">
            <MessageSquare className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm">
              {searchQuery ? 'No matching conversations' : 'No conversations yet'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => handleSelectSession(session)}
                className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${
                  currentSessionId === session.shortId || currentSessionId === session.id
                    ? 'bg-joa-primary bg-opacity-5 border-l-4 border-joa-primary'
                    : ''
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Title */}
                    <h3 className="font-medium text-gray-900 truncate mb-1">
                      {session.title}
                    </h3>
                    
                    {/* Metadata */}
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(session.updatedAt)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Hash className="w-3 h-3" />
                        {session.messageCount} msg{session.messageCount !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {/* Short ID (for debugging/sharing) */}
                    <div className="mt-1 text-xs text-gray-400 font-mono">
                      /{session.shortId}
                    </div>
                  </div>

                  {/* Actions */}
                  <button
                    onClick={(e) => handleDeleteSession(session.id, e)}
                    className="flex-shrink-0 p-1.5 text-gray-400 hover:text-teal-700 hover:bg-teal-50 rounded transition-colors"
                    title="Delete session"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Auto-generated title indicator */}
                {session.autoTitle && (
                  <div className="mt-2 inline-flex items-center px-2 py-0.5 bg-purple-50 text-purple-700 rounded text-xs">
                    <span className="inline-block w-1.5 h-1.5 bg-purple-500 rounded-full mr-1.5"></span>
                    Auto-titled
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {total > 20 && (
        <div className="flex-shrink-0 border-t border-gray-200 p-4">
          <div className="flex items-center justify-between text-sm">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-gray-700 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-gray-600">
              Page {page} of {Math.ceil(total / 20)}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= Math.ceil(total / 20)}
              className="px-3 py-1.5 text-gray-700 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

