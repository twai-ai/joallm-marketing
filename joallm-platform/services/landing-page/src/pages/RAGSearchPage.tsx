import React, { useState, useEffect } from 'react';
import { Search, FileText, TrendingUp, Hash, Calendar, Copy, Download, Filter, SortAsc, SortDesc, BookOpen, Users, Clock, Target, MessageSquare, Bot, BarChart3, ArrowLeft, Home } from 'lucide-react';
import { useRAG } from '../hooks/useRAG';
import { useDocuments } from '../hooks/useDocuments';
import { RAGChatInterface } from '../components/rag/RAGChatInterface';
import { KnowledgeManagerNew } from '../components/knowledge/KnowledgeManagerNew';
import { RAGAnalyticsDashboard } from '../components/rag/RAGAnalyticsDashboard';

interface RAGSearchPageProps {
  className?: string;
}

export function RAGSearchPage({ className = '' }: RAGSearchPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'relevance' | 'date' | 'filename'>('relevance');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterRelevance, setFilterRelevance] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'search' | 'chat' | 'knowledge'>('chat');
  const [analyticsOpen, setAnalyticsOpen] = useState(false);

  const { search, searchResults, isSearching } = useRAG();
  const { documents } = useDocuments();

  // Load search history from localStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem('rag-search-history');
    if (savedHistory) {
      setSearchHistory(JSON.parse(savedHistory));
    }
  }, []);

  // Save search history
  const saveSearchHistory = (query: string) => {
    if (query.trim() && !searchHistory.includes(query)) {
      const newHistory = [query, ...searchHistory.slice(0, 9)]; // Keep last 10 searches
      setSearchHistory(newHistory);
      localStorage.setItem('rag-search-history', JSON.stringify(newHistory));
    }
  };

  // Utility functions (same as KnowledgeManagerNew)
  const highlightKeywords = (text: string, query: string): string => {
    if (!query.trim()) return text;
    
    const keywords = query.toLowerCase().split(/\s+/).filter(word => word.length > 2);
    let highlightedText = text;
    
    keywords.forEach(keyword => {
      const regex = new RegExp(`(${keyword})`, 'gi');
      highlightedText = highlightedText.replace(regex, '<mark class="bg-yellow-200 text-yellow-900 px-1 rounded">$1</mark>');
    });
    
    return highlightedText;
  };

  const formatSearchMetadata = (result: any) => {
    const metadata = result.metadata || {};
    const file = result.file || {};
    
    return {
      filename: file.filename || metadata.filename || result.documentName || 'Unknown Document',
      chunkIndex: metadata.chunkIndex !== undefined ? metadata.chunkIndex + 1 : 'N/A',
      startChar: metadata.startChar || 0,
      endChar: metadata.endChar || 0,
      score: result.score,
      uploadDate: file.uploadDate || metadata.uploadDate,
      size: file.size || metadata.size,
      fileId: file.id || metadata.fileId || result.id,
      documentId: result.documentId || file.id || metadata.fileId
    };
  };

  const generateCitation = (metadata: any, index: number) => {
    const filename = metadata.filename;
    const chunkIndex = metadata.chunkIndex;
    const uploadDate = metadata.uploadDate ? new Date(metadata.uploadDate).toLocaleDateString() : 'Unknown Date';
    
    return {
      id: `citation-${index}`,
      text: `${filename}, Chunk ${chunkIndex}`,
      fullCitation: `${filename} (${uploadDate}), Chunk ${chunkIndex}, Position ${metadata.startChar}-${metadata.endChar}`,
      filename,
      chunkIndex,
      uploadDate,
      position: `${metadata.startChar}-${metadata.endChar}`
    };
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    await search(searchQuery, {
      documentIds: selectedDocuments.length > 0 ? selectedDocuments : undefined,
    });
    
    saveSearchHistory(searchQuery);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSearch();
    }
  };

  const filteredResults = searchResults?.filter(result => {
    if (filterRelevance === 'all') return true;
    const score = result.score;
    switch (filterRelevance) {
      case 'high': return score > 0.8;
      case 'medium': return score > 0.6 && score <= 0.8;
      case 'low': return score <= 0.6;
      default: return true;
    }
  }) || [];

  const sortedResults = [...filteredResults].sort((a, b) => {
    const metadataA = formatSearchMetadata(a);
    const metadataB = formatSearchMetadata(b);
    
    switch (sortBy) {
      case 'relevance':
        return sortOrder === 'desc' ? b.score - a.score : a.score - b.score;
      case 'date': {
        const dateA = new Date(metadataA.uploadDate || 0);
        const dateB = new Date(metadataB.uploadDate || 0);
        return sortOrder === 'desc' ? dateB.getTime() - dateA.getTime() : dateA.getTime() - dateB.getTime();
      }
      case 'filename':
        return sortOrder === 'desc' 
          ? metadataB.filename.localeCompare(metadataA.filename)
          : metadataA.filename.localeCompare(metadataB.filename);
      default:
        return 0;
    }
  });

  const exportResults = () => {
    if (!searchResults || searchResults.length === 0) return;
    
    const exportData = {
      query: searchQuery,
      timestamp: new Date().toISOString(),
      totalResults: searchResults.length,
      results: searchResults.map((result, index) => {
        const metadata = formatSearchMetadata(result);
        const citation = generateCitation(metadata, index);
        return {
          rank: index + 1,
          content: result.content,
          citation: citation.fullCitation,
          relevance: result.score,
          metadata: metadata
        };
      })
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rag-search-results-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 ${className}`}>
      {/* Enhanced Header */}
        <div className="bg-white/80 backdrop-blur-sm shadow-lg border-b border-gray-200/50 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-20">
              <div className="flex items-center gap-4">
                <div className="relative">
                <div className="w-12 h-12 bg-gradient-to-r from-joa-primary via-red-600 to-joa-accent rounded-xl flex items-center justify-center shadow-lg">
                  {activeTab === 'chat' ? <Bot className="w-6 h-6 text-white" /> : 
                   activeTab === 'search' ? <Search className="w-6 h-6 text-white" /> :
                   <FileText className="w-6 h-6 text-white" />}
                </div>
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white animate-pulse"></div>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {activeTab === 'chat' ? 'JoaLLM Knowledge Chat' : 
                   activeTab === 'search' ? 'JoaLLM RAG Search' : 
                   'JoaLLM Knowledge Manager'}
                </h1>
                <p className="text-sm text-gray-600 mt-1">
                  {activeTab === 'chat' 
                    ? '💬 Chat with your knowledge base using AI' 
                    : activeTab === 'search'
                    ? '🔍 Advanced semantic search across your knowledge base'
                    : '📁 Upload and manage your knowledge base documents'
                  }
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-green-700">
                  {documents.length} documents indexed
                </span>
              </div>
              
              {/* Analytics Button */}
              <button
                onClick={() => setAnalyticsOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg transition-all duration-200 shadow-md hover:shadow-lg text-sm font-medium"
              >
                <BarChart3 className="w-4 h-4" />
                Analytics Dashboard
              </button>
              
              {searchResults && activeTab === 'search' && (
                <button
                  onClick={exportResults}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-joa-primary to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-lg transition-all duration-200 shadow-md hover:shadow-lg text-sm font-medium"
                >
                  <Download className="w-4 h-4" />
                  Export Results
                </button>
              )}
            </div>
          </div>
          
          {/* Enhanced Tabs */}
          <div className="flex bg-gray-50/50 rounded-lg p-1 mb-4">
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex items-center gap-3 px-6 py-3 text-sm font-medium rounded-md transition-all duration-200 ${
                activeTab === 'chat'
                  ? 'bg-white text-joa-primary shadow-md border border-joa-primary/20'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
              }`}
            >
              <MessageSquare className="w-5 h-5" />
              <span>Chat with Knowledge Base</span>
              {activeTab === 'chat' && (
                <div className="w-2 h-2 bg-joa-primary rounded-full animate-pulse"></div>
              )}
            </button>
            <button
              onClick={() => setActiveTab('search')}
              className={`flex items-center gap-3 px-6 py-3 text-sm font-medium rounded-md transition-all duration-200 ${
                activeTab === 'search'
                  ? 'bg-white text-joa-primary shadow-md border border-joa-primary/20'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
              }`}
            >
              <Search className="w-5 h-5" />
              <span>Advanced Search</span>
              {activeTab === 'search' && (
                <div className="w-2 h-2 bg-joa-primary rounded-full animate-pulse"></div>
              )}
            </button>
            <button
              onClick={() => setActiveTab('knowledge')}
              className={`flex items-center gap-3 px-6 py-3 text-sm font-medium rounded-md transition-all duration-200 ${
                activeTab === 'knowledge'
                  ? 'bg-white text-joa-primary shadow-md border border-joa-primary/20'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
              }`}
            >
              <FileText className="w-5 h-5" />
              <span>Knowledge Manager</span>
              {activeTab === 'knowledge' && (
                <div className="w-2 h-2 bg-joa-primary rounded-full animate-pulse"></div>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Breadcrumb */}
      <div className="bg-white/60 backdrop-blur-sm border-b border-gray-200/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center gap-3 text-sm">
            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent('navigateToView', { detail: { view: 'welcome' } }));
              }}
              className="flex items-center gap-2 text-gray-600 hover:text-joa-primary transition-colors"
            >
              <Home className="w-4 h-4" />
              <span>Home</span>
            </button>
            <span className="text-gray-400">/</span>
            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent('navigateToView', { detail: { view: 'chat' } }));
              }}
              className="text-gray-600 hover:text-joa-primary transition-colors"
            >
              Chat
            </button>
            <span className="text-gray-400">/</span>
            <span className="text-joa-primary font-medium">Knowledge Base</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'chat' ? (
          /* Chat Interface */
          <div className="h-[calc(100vh-200px)]">
            <RAGChatInterface 
              className="h-full"
              documentIds={selectedDocuments.length > 0 ? selectedDocuments : undefined}
            />
          </div>
        ) : activeTab === 'knowledge' ? (
          /* Knowledge Manager Interface */
          <div className="h-[calc(100vh-200px)]">
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/50 h-full">
              <KnowledgeManagerNew isOpen={true} onClose={() => {}} inline={true} />
            </div>
          </div>
        ) : (
          /* Search Interface */
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Search Panel */}
            <div className="lg:col-span-1">
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/50 p-6 sticky top-8">
              <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-r from-joa-primary to-red-600 rounded-lg flex items-center justify-center">
                  <Target className="w-4 h-4 text-white" />
                </div>
                Search & Filter
              </h2>
              
              {/* Enhanced Search Input */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  🔍 Search Query
                </label>
                <div className="relative">
                  <textarea
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Enter your search query..."
                    className="w-full px-4 py-3 pr-12 border border-gray-300/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-joa-primary/50 focus:border-joa-primary min-h-[120px] resize-none bg-white/90 backdrop-blur-sm shadow-sm transition-all duration-200"
                  />
                  <div className="absolute right-3 top-3 text-gray-400">
                    <Search className="w-5 h-5" />
                  </div>
                </div>
                <button
                  onClick={handleSearch}
                  disabled={!searchQuery.trim() || isSearching}
                  className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-joa-primary to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl font-medium"
                >
                  {isSearching ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  <span>{isSearching ? 'Searching...' : 'Search Knowledge Base'}</span>
                </button>
              </div>

              {/* Enhanced Search History */}
              {searchHistory.length > 0 && (
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    📚 Recent Searches
                  </label>
                  <div className="space-y-2">
                    {searchHistory.slice(0, 5).map((query, index) => (
                      <button
                        key={index}
                        onClick={() => setSearchQuery(query)}
                        className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 hover:text-gray-900 rounded-lg transition-all duration-200 border border-transparent hover:border-blue-200"
                      >
                        {query}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Enhanced Filters */}
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    🎯 Relevance Filter
                  </label>
                  <select
                    value={filterRelevance}
                    onChange={(e) => setFilterRelevance(e.target.value as any)}
                    className="w-full px-4 py-3 border border-gray-300/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-joa-primary/50 focus:border-joa-primary bg-white/90 backdrop-blur-sm shadow-sm transition-all duration-200"
                  >
                    <option value="all">All Results</option>
                    <option value="high">High Relevance (80%+)</option>
                    <option value="medium">Medium Relevance (60-80%)</option>
                    <option value="low">Low Relevance (&lt;60%)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    📊 Sort By
                  </label>
                  <div className="flex gap-3">
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="flex-1 px-4 py-3 border border-gray-300/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-joa-primary/50 focus:border-joa-primary bg-white/90 backdrop-blur-sm shadow-sm transition-all duration-200"
                    >
                      <option value="relevance">Relevance</option>
                      <option value="date">Date</option>
                      <option value="filename">Filename</option>
                    </select>
                    <button
                      onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                      className="px-4 py-3 border border-gray-300/50 rounded-xl hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all duration-200 shadow-sm hover:shadow-md"
                    >
                      {sortOrder === 'asc' ? <SortAsc className="w-5 h-5" /> : <SortDesc className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Results Panel */}
          <div className="lg:col-span-3">
            {isSearching ? (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-joa-primary"></div>
                  <span className="ml-3 text-gray-600">Searching your knowledge base...</span>
                </div>
              </div>
            ) : searchResults && searchResults.length > 0 ? (
              <div className="space-y-6">
                {/* Results Header */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-joa-primary" />
                        Search Results ({sortedResults.length})
                      </h2>
                      <p className="text-sm text-gray-600 mt-1">
                        Query: "{searchQuery}" • {searchResults.length} total results
                      </p>
                    </div>
                    <div className="text-sm text-gray-500">
                      {new Date().toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Results */}
                <div className="space-y-4">
                  {sortedResults.map((result, index) => {
                    const metadata = formatSearchMetadata(result);
                    const highlightedContent = highlightKeywords(result.content, searchQuery);
                    
                    return (
                      <div key={result.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
                        {/* Result Header */}
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-joa-primary text-white rounded-full flex items-center justify-center text-sm font-bold">
                              {index + 1}
                            </div>
                            <div>
                              <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                                <FileText className="w-4 h-4" />
                                {metadata.filename}
                              </h3>
                              <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                                <span className="flex items-center gap-1">
                                  <Hash className="w-3 h-3" />
                                  Chunk {metadata.chunkIndex}
                                </span>
                                <span className="flex items-center gap-1">
                                  <TrendingUp className="w-3 h-3" />
                                  {(metadata.score * 100).toFixed(1)}% match
                                </span>
                                {metadata.uploadDate && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {new Date(metadata.uploadDate).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                              metadata.score > 0.8 ? 'bg-green-100 text-green-800' :
                              metadata.score > 0.6 ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {metadata.score > 0.8 ? 'High Relevance' : metadata.score > 0.6 ? 'Medium Relevance' : 'Low Relevance'}
                            </div>
                          </div>
                        </div>
                        
                        {/* Content */}
                        <div className="bg-gray-50 p-4 rounded-lg border mb-4">
                          <div 
                            className="text-gray-700 leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: highlightedContent }}
                          />
                        </div>
                        
                        {/* Citation */}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                          <div className="flex items-center gap-2 mb-2">
                            <BookOpen className="w-4 h-4 text-blue-600" />
                            <span className="text-sm font-medium text-blue-900">Source Citation</span>
                          </div>
                          <div className="text-sm text-blue-800">
                            <div className="font-medium">{metadata.filename}</div>
                            <div className="text-xs text-blue-600 mt-1">
                              Chunk {metadata.chunkIndex} • Position {metadata.startChar}-{metadata.endChar} • 
                              {metadata.uploadDate && ` Uploaded ${new Date(metadata.uploadDate).toLocaleDateString()}`}
                            </div>
                          </div>
                        </div>
                        
                        {/* Actions */}
                        <div className="flex items-center justify-between">
                          <div className="text-xs text-gray-500">
                            Position: {metadata.startChar}-{metadata.endChar} • 
                            {metadata.size && ` Size: ${(metadata.size / 1024).toFixed(1)} KB`}
                          </div>
                          <div className="flex items-center gap-2">
                            <button 
                              className="flex items-center gap-1 px-3 py-1 text-xs bg-joa-primary hover:bg-red-800 text-white rounded transition-colors"
                              onClick={() => {
                                const citation = generateCitation(metadata, index);
                                navigator.clipboard?.writeText(`${result.content}\n\nSource: ${citation.fullCitation}`);
                              }}
                            >
                              <Copy className="w-3 h-3" />
                              Copy with Citation
                            </button>
                            <button 
                              className="flex items-center gap-1 px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors"
                              onClick={() => {
                                navigator.clipboard?.writeText(result.content);
                              }}
                            >
                              <Copy className="w-3 h-3" />
                              Copy Text
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Citations Summary */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <BookOpen className="w-5 h-5 text-blue-600" />
                    <h3 className="text-lg font-semibold text-blue-900">References & Citations</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {sortedResults.map((result, index) => {
                      const metadata = formatSearchMetadata(result);
                      const citation = generateCitation(metadata, index);
                      return (
                        <div key={citation.id} className="flex items-center justify-between bg-white p-3 rounded border">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center text-xs font-bold">
                              {index + 1}
                            </span>
                            <span className="text-sm text-blue-800 font-medium">{citation.text}</span>
                          </div>
                          <button 
                            className="text-blue-600 hover:text-blue-800 transition-colors text-xs"
                            onClick={() => {
                              navigator.clipboard?.writeText(citation.fullCitation);
                            }}
                          >
                            Copy
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-4 p-3 bg-white rounded border">
                    <p className="text-sm font-medium text-blue-900 mb-2">📚 Academic Citation Format:</p>
                    <p className="text-xs text-blue-700 italic">
                      "JoaLLM Knowledge Base Search Results. Retrieved from {new Date().toLocaleDateString()}. 
                      Query: '{searchQuery}'. {searchResults.length} results found."
                    </p>
                  </div>
                </div>
              </div>
            ) : searchResults && searchResults.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
                <div className="text-center">
                  <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No results found</h3>
                  <p className="text-gray-600 mb-4">Try adjusting your search terms or filters</p>
                  <div className="text-sm text-gray-500">
                    <p>💡 Search tips:</p>
                    <ul className="mt-2 space-y-1">
                      <li>• Use specific keywords</li>
                      <li>• Try synonyms or related terms</li>
                      <li>• Check if documents are processed</li>
                      <li>• Adjust relevance filters</li>
                    </ul>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
                <div className="text-center">
                  <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Ready to Search</h3>
                  <p className="text-gray-600">Enter a search query to find relevant information in your knowledge base</p>
                </div>
              </div>
            )}
          </div>
        </div>
        )}
      </div>
      
      {/* Analytics Dashboard */}
      <RAGAnalyticsDashboard isOpen={analyticsOpen} onClose={() => setAnalyticsOpen(false)} />
    </div>
  );
}
