import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Search, 
  Plus, 
  History, 
  Settings, 
  BarChart3,
  MessageSquare,
  Database,
  Hash,
  Filter,
  ArrowLeft,
  Home
} from 'lucide-react';
import { useRAGSessions } from '../../hooks/useRAGSessions';
import { useRAG } from '../../hooks/useRAG';
import { RAGSessionHistory } from './RAGSessionHistory';
import { AdvancedSearchPanel } from './AdvancedSearchPanel';
import { RAGChatInterface } from './RAGChatInterface';
import { showSuccess, showError } from '../../utils/toast';

interface RAGSearchInterfaceProps {
  className?: string;
}

export function RAGSearchInterface({ className = '' }: RAGSearchInterfaceProps) {
  const { sessionId } = useParams<{ sessionId?: string }>();
  const navigate = useNavigate();
  
  const {
    sessions,
    activeSession,
    activeSessionId,
    queries,
    createSession,
    setActiveSession,
    deleteSession,
    isLoading: sessionsLoading,
  } = useRAGSessions();

  const { search, searchResults, isSearching } = useRAG();
  
  const [showHistory, setShowHistory] = useState(true);
  const [activeTab, setActiveTab] = useState<'search' | 'chat'>('search');
  const [searchQuery, setSearchQuery] = useState('');

  // Set active session when sessionId changes
  useEffect(() => {
    if (sessionId) {
      // Find session by shortId
      const session = sessions.find(s => s.shortId === sessionId);
      if (session) {
        setActiveSession(session.id);
      } else if (!sessionsLoading) {
        // Session not found, redirect to main RAG search
        navigate('/rag-search');
      }
    } else {
      // No sessionId in URL - if we have sessions, use the first one
      if (sessions.length > 0 && !activeSessionId) {
        setActiveSession(sessions[0].id);
        navigate(`/rag-search/${sessions[0].shortId}`, { replace: true });
      }
    }
  }, [sessionId, sessions, activeSessionId, setActiveSession, navigate, sessionsLoading]);

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
      
      navigate(`/rag-search/${newSession.shortId}`);
    } catch (error) {
      console.error('Failed to create new session:', error);
      showError('Failed to create new RAG search session');
    }
  };

  const handleSearch = async (query: string, options?: any) => {
    if (!activeSessionId) {
      showError('No active session. Please create a new search session first.');
      return;
    }

    try {
      await search(query, {
        ...options,
        sessionId: activeSessionId
      });
    } catch (error) {
      console.error('Search failed:', error);
      showError('Search failed. Please try again.');
    }
  };

  const handleBackToWelcome = () => {
    navigate('/');
  };

  const sessionTitle = activeSession?.title || 'RAG Search';

  return (
    <div className={`flex h-full ${className}`}>
      {/* Session History Sidebar - Collapsible */}
      {showHistory && (
        <RAGSessionHistory
          sessions={sessions}
          activeSessionId={activeSessionId}
          queries={queries}
          onSelectSession={(sessionId) => {
            const session = sessions.find(s => s.id === sessionId);
            if (session) {
              navigate(`/rag-search/${session.shortId}`);
            }
          }}
          onDeleteSession={deleteSession}
          onNewSearch={handleNewSearch}
        />
      )}

      {/* Main Search Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            >
              <History className="w-5 h-5" />
            </button>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={handleBackToWelcome}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              >
                <Home className="w-5 h-5" />
              </button>
              <div className="h-6 w-px bg-gray-300 dark:bg-gray-600" />
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                {sessionTitle}
              </h1>
              {activeSession && (
                <div className="flex items-center space-x-1 text-sm text-gray-500 dark:text-gray-400">
                  <span>•</span>
                  <span>ID: {activeSession.shortId}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleNewSearch}
              className="flex items-center space-x-2 px-3 py-2 bg-joa-primary text-white rounded-lg hover:bg-red-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm">New Search</span>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('search')}
            className={`flex items-center space-x-2 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'search'
                ? 'bg-white dark:bg-gray-900 text-joa-primary border-b-2 border-joa-primary'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <Search className="w-4 h-4" />
            <span>Advanced Search</span>
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex items-center space-x-2 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'chat'
                ? 'bg-white dark:bg-gray-900 text-joa-primary border-b-2 border-joa-primary'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Chat with Knowledge</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'search' ? (
            <AdvancedSearchPanel
              onSearch={handleSearch}
              searchResults={searchResults}
              isSearching={isSearching}
              sessionId={activeSessionId}
            />
          ) : (
            <RAGChatInterface
              sessionId={activeSessionId}
              onSearch={handleSearch}
            />
          )}
        </div>
      </div>
    </div>
  );
}
