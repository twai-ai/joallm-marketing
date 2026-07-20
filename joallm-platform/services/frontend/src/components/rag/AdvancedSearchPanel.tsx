import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Settings, 
  Zap, 
  Target, 
  Brain, 
  X, 
  ChevronDown,
  ChevronUp,
  Sliders,
  BarChart3,
  Clock,
  FileText
} from 'lucide-react';
import { useHybridSearch, useQueryEnhancement } from '../../hooks/useAdvancedRAG';
import { HybridSearchResult } from '../../services/ragApi';

interface AdvancedSearchPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onResultsSelect?: (results: HybridSearchResult[]) => void;
  availableDocuments?: Array<{ id: string; name: string }>;
}

export function AdvancedSearchPanel({ 
  isOpen, 
  onClose, 
  onResultsSelect,
  availableDocuments = [] 
}: AdvancedSearchPanelProps) {
  const [query, setQuery] = useState('');
  const [enhancedQuery, setEnhancedQuery] = useState('');
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [searchOptions, setSearchOptions] = useState({
    limit: 5,
    vectorWeight: 0.7,
    keywordWeight: 0.3,
    threshold: 0.1,
    includeMetadata: true
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [searchResults, setSearchResults] = useState<HybridSearchResult[]>([]);

  const { search: hybridSearch, isSearching, searchResults: hybridResults } = useHybridSearch();
  const { enhanceQuery, isEnhancing, enhancementResult } = useQueryEnhancement();

  // Auto-enhance query when it changes
  useEffect(() => {
    if (query.length > 10) {
      const timer = setTimeout(() => {
        enhanceQuery({ 
          query, 
          enhancementType: 'rewrite',
          maxExpansions: 2 
        });
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [query, enhanceQuery]);

  // Update enhanced query when enhancement result changes
  useEffect(() => {
    if (enhancementResult?.enhancedQuery) {
      setEnhancedQuery(enhancementResult.enhancedQuery);
    }
  }, [enhancementResult]);

  // Update search results when hybrid search completes
  useEffect(() => {
    if (hybridResults?.results) {
      setSearchResults(hybridResults.results);
    }
  }, [hybridResults]);

  const handleSearch = async () => {
    if (!query.trim()) return;

    try {
      await hybridSearch({
        query: enhancedQuery || query,
        fileIds: selectedDocuments.length > 0 ? selectedDocuments : undefined,
        ...searchOptions
      });
    } catch (error) {
      console.error('Search failed:', error);
    }
  };

  const handleDocumentToggle = (documentId: string) => {
    setSelectedDocuments(prev => 
      prev.includes(documentId) 
        ? prev.filter(id => id !== documentId)
        : [...prev, documentId]
    );
  };

  const handleResultSelect = (result: HybridSearchResult) => {
    if (onResultsSelect) {
      onResultsSelect([result]);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600 bg-green-50 dark:bg-green-900/20';
    if (score >= 0.6) return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20';
    return 'text-gray-600 bg-gray-50 dark:bg-gray-900/20';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <Search className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Advanced RAG Search
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto h-full">
          <div className="space-y-6">
            {/* Query Input */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Search Query
                </label>
                <textarea
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Enter your search query..."
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  rows={3}
                />
              </div>

              {/* Query Enhancement */}
              {isEnhancing && (
                <div className="flex items-center space-x-2 text-sm text-blue-600">
                  <Brain className="w-4 h-4 animate-pulse" />
                  <span>Enhancing query...</span>
                </div>
              )}

              {enhancedQuery && enhancedQuery !== query && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <Zap className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                      Enhanced Query
                    </span>
                  </div>
                  <p className="text-sm text-blue-700 dark:text-blue-300">{enhancedQuery}</p>
                </div>
              )}

              {/* Query Classification */}
              {enhancementResult?.queryClassification && (
                <div className="flex items-center space-x-4 text-sm">
                  <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-gray-700 dark:text-gray-300">
                    Type: {enhancementResult.queryClassification.type}
                  </span>
                  <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-gray-700 dark:text-gray-300">
                    Complexity: {enhancementResult.queryClassification.complexity}
                  </span>
                  <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-gray-700 dark:text-gray-300">
                    Domain: {enhancementResult.queryClassification.domain}
                  </span>
                </div>
              )}
            </div>

            {/* Document Selection */}
            {availableDocuments.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Search in Documents (Optional)
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                  {availableDocuments.map((doc) => (
                    <label key={doc.id} className="flex items-center space-x-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded">
                      <input
                        type="checkbox"
                        checked={selectedDocuments.includes(doc.id)}
                        onChange={() => handleDocumentToggle(doc.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                        {doc.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Advanced Options */}
            <div>
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              >
                <Sliders className="w-4 h-4" />
                <span>Advanced Options</span>
                {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showAdvanced && (
                <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Results Limit
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={searchOptions.limit}
                        onChange={(e) => setSearchOptions(prev => ({ ...prev, limit: parseInt(e.target.value) }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Relevance Threshold
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="1"
                        step="0.1"
                        value={searchOptions.threshold}
                        onChange={(e) => setSearchOptions(prev => ({ ...prev, threshold: parseFloat(e.target.value) }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Vector Weight: {searchOptions.vectorWeight}
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={searchOptions.vectorWeight}
                        onChange={(e) => setSearchOptions(prev => ({ 
                          ...prev, 
                          vectorWeight: parseFloat(e.target.value),
                          keywordWeight: 1 - parseFloat(e.target.value)
                        }))}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Keyword Weight: {searchOptions.keywordWeight}
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={searchOptions.keywordWeight}
                        onChange={(e) => setSearchOptions(prev => ({ 
                          ...prev, 
                          keywordWeight: parseFloat(e.target.value),
                          vectorWeight: 1 - parseFloat(e.target.value)
                        }))}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Search Button */}
            <button
              onClick={handleSearch}
              disabled={!query.trim() || isSearching}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center space-x-2"
            >
              {isSearching ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Searching...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>Search</span>
                </>
              )}
            </button>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                  <BarChart3 className="w-5 h-5 mr-2 text-blue-600" />
                  Search Results ({searchResults.length})
                </h3>
                <div className="space-y-3">
                  {searchResults.map((result, index) => (
                    <div
                      key={result.id}
                      onClick={() => handleResultSelect(result)}
                      className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                            #{index + 1}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getScoreColor(result.score)}`}>
                            {(result.score * 100).toFixed(1)}% match
                          </span>
                        </div>
                        <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
                          <span>Vector: {(result.vectorScore * 100).toFixed(1)}%</span>
                          <span>Keyword: {(result.keywordScore * 100).toFixed(1)}%</span>
                        </div>
                      </div>
                      
                      <p className="text-gray-900 dark:text-white mb-2 line-clamp-3">
                        {result.content}
                      </p>
                      
                      <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                        <div className="flex items-center space-x-2">
                          <FileText className="w-4 h-4" />
                          <span>{result.file.filename}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Clock className="w-4 h-4" />
                          <span>{new Date(result.file.uploadDate).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* No Results */}
            {searchResults.length === 0 && !isSearching && query && (
              <div className="text-center py-8">
                <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">No results found for your query.</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                  Try adjusting your search terms or lowering the relevance threshold.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
