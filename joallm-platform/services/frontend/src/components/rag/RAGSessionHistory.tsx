import React, { useState } from 'react';
import { 
  Search, 
  Plus, 
  Trash2, 
  Clock, 
  Hash, 
  Filter,
  Database,
  History,
  X
} from 'lucide-react';
import { RAGSearchSession, RAGSearchQuery } from '../../stores/ragSessionStore';

interface RAGSessionHistoryProps {
  sessions: RAGSearchSession[];
  activeSessionId: string | null;
  queries: RAGSearchQuery[];
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onNewSearch: () => void;
}

export function RAGSessionHistory({
  sessions,
  activeSessionId,
  queries,
  onSelectSession,
  onDeleteSession,
  onNewSearch,
}: RAGSessionHistoryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showQueries, setShowQueries] = useState(false);

  const filteredSessions = sessions.filter(session =>
    !searchQuery.trim() ||
    session.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    session.searchType.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDeleteSession = async (sessionId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    
    if (!confirm('Are you sure you want to delete this RAG search session?')) {
      return;
    }

    onDeleteSession(sessionId);
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

  const activeSession = sessions.find(s => s.id === activeSessionId);
  const activeSessionQueries = queries.filter(q => q.sessionId === activeSessionId);

  return (
    <div className="w-80 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Search History
          </h2>
          <button
            onClick={onNewSearch}
            className="flex items-center space-x-2 px-3 py-2 bg-joa-primary text-white rounded-lg hover:bg-teal-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm">New</span>
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
        {filteredSessions.length === 0 ? (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
            {searchQuery ? 'No sessions found matching your search.' : 'No RAG search sessions yet.'}
          </div>
        ) : (
          <div className="p-2">
            {filteredSessions.map((session) => (
              <div
                key={session.id}
                onClick={() => onSelectSession(session.id)}
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

      {/* Active Session Queries */}
      {activeSession && activeSessionQueries.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700">
          <div className="p-3 border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setShowQueries(!showQueries)}
              className="flex items-center justify-between w-full text-left"
            >
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                Recent Queries ({activeSessionQueries.length})
              </span>
              <div className={`transform transition-transform ${showQueries ? 'rotate-180' : ''}`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>
          </div>
          
          {showQueries && (
            <div className="max-h-48 overflow-y-auto">
              {activeSessionQueries.slice(0, 10).map((query) => (
                <div
                  key={query.id}
                  className="p-3 border-b border-gray-100 dark:border-gray-800 last:border-b-0"
                >
                  <div className="text-sm text-gray-900 dark:text-white mb-1">
                    {query.query}
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>{query.resultsCount} results</span>
                    <span>{formatDate(query.createdAt)}</span>
                  </div>
                  {query.averageScore && (
                    <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      Avg Score: {query.averageScore.toFixed(3)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
