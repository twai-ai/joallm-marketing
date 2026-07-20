import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  Plus, 
  Trash2, 
  Clock, 
  Hash, 
  Filter,
  X,
  History,
  Database
} from 'lucide-react';
import { useRAGSessions } from '../../hooks/useRAGSessions';
import { RAGSearchSession } from '../../stores/ragSessionStore';
import { showError } from '../../utils/toast';

interface RAGSessionListProps {
  currentSessionId?: string;
  onClose?: () => void;
}

export function RAGSessionList({ currentSessionId, onClose }: RAGSessionListProps) {
  const navigate = useNavigate();
  const { 
    sessions, 
    activeSessionId, 
    deleteSession, 
    isLoading,
    createSession 
  } = useRAGSessions();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredSessions, setFilteredSessions] = useState<RAGSearchSession[]>([]);

  // Filter sessions based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredSessions(sessions);
    } else {
      const filtered = sessions.filter(session =>
        session.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        session.searchType.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredSessions(filtered);
    }
  }, [sessions, searchQuery]);

  const handleSelectSession = (session: RAGSearchSession) => {
    // Navigate to session using shortId
    navigate(`/rag-search/${session.shortId}`);
    onClose?.();
  };

  const handleDeleteSession = async (sessionId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    
    if (!confirm('Are you sure you want to delete this RAG search session?')) {
      return;
    }

    try {
      await deleteSession(sessionId);
    } catch (error) {
      console.error('Failed to delete session:', error);
      showError('Failed to delete RAG search session');
    }
  };

  const handleNewSearch = async () => {
    try {
      const newSession = await createSession({
        title: 'New RAG Search',
        searchType: 'hybrid',
        parameters: {
          limit: 5,
          threshold: 0.1,
          vectorWeight: 0.7,
          keywordWeight: 0.3,
          includeMetadata: true
        }
      });
      
      // Navigate to the new session
      navigate(`/rag-search/${newSession.shortId}`);
      onClose?.();
    } catch (error) {
      console.error('Failed to create new session:', error);
      showError('Failed to create new RAG search session');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 24 * 7) {
      return date.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const getSearchTypeIcon = (searchType: string) => {
    switch (searchType) {
      case 'vector':
        return <Database className="w-4 h-4" />;
      case 'keyword':
        return <Hash className="w-4 h-4" />;
      case 'hybrid':
        return <Filter className="w-4 h-4" />;
      default:
        return <Search className="w-4 h-4" />;
    }
  };

  const getSearchTypeColor = (searchType: string) => {
    switch (searchType) {
      case 'vector':
        return 'text-blue-500';
      case 'keyword':
        return 'text-green-500';
      case 'hybrid':
        return 'text-purple-500';
      default:
        return 'text-gray-500';
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            RAG Search Sessions
          </h2>
          <button
            onClick={handleNewSearch}
            className="flex items-center space-x-2 px-3 py-2 bg-joa-primary text-white rounded-lg hover:bg-red-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm">New Search</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search sessions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-joa-primary focus:border-transparent"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
            Loading sessions...
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
            {searchQuery ? 'No sessions found matching your search.' : 'No RAG search sessions yet.'}
            <br />
            <button
              onClick={handleNewSearch}
              className="mt-2 text-joa-primary hover:text-red-800 font-medium"
            >
              Create your first search session
            </button>
          </div>
        ) : (
          <div className="p-2">
            {filteredSessions.map((session) => (
              <div
                key={session.id}
                onClick={() => handleSelectSession(session)}
                className={`p-3 rounded-lg cursor-pointer transition-colors mb-2 group ${
                  activeSessionId === session.id
                    ? 'bg-joa-primary/10 border border-joa-primary/20'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800 border border-transparent'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <div className={`${getSearchTypeColor(session.searchType)}`}>
                        {getSearchTypeIcon(session.searchType)}
                      </div>
                      <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {session.title}
                      </h3>
                    </div>
                    
                    <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                      <div className="flex items-center space-x-1">
                        <History className="w-3 h-3" />
                        <span>{session.queryCount} queries</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Clock className="w-3 h-3" />
                        <span>{formatDate(session.updatedAt)}</span>
                      </div>
                    </div>
                    
                    <div className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                      ID: {session.shortId}
                    </div>
                  </div>
                  
                  <button
                    onClick={(e) => handleDeleteSession(session.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
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
