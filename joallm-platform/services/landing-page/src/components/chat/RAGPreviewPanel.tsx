import React, { useState, useEffect, useRef } from 'react';
import { Search, FileText, TrendingUp, AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react';
import { RAGContextPreview } from '../../types';

interface RAGPreviewPanelProps {
  query: string;
  selectedDocumentIds: string[];
  onSearch: (query: string, documentIds: string[]) => Promise<RAGContextPreview[]>;
  isVisible?: boolean;
  onToggleVisibility?: () => void;
  debounceMs?: number;
  minQueryLength?: number;
}

export function RAGPreviewPanel({
  query,
  selectedDocumentIds,
  onSearch,
  isVisible = true,
  onToggleVisibility,
  debounceMs = 500,
  minQueryLength = 10,
}: RAGPreviewPanelProps) {
  const [results, setResults] = useState<RAGContextPreview[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Don't search if query is too short or no documents selected
    if (query.length < minQueryLength || selectedDocumentIds.length === 0) {
      setResults([]);
      setError(null);
      return;
    }

    // Debounced search
    debounceTimerRef.current = setTimeout(() => {
      performSearch();
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query, selectedDocumentIds, minQueryLength, debounceMs]);

  const performSearch = async () => {
    setIsSearching(true);
    setError(null);

    try {
      const searchResults = await onSearch(query, selectedDocumentIds);
      setResults(searchResults.slice(0, 3)); // Top 3 results
    } catch (err) {
      console.error('RAG preview search failed:', err);
      setError('Failed to search documents');
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const getTotalTokens = () => {
    return results.reduce((sum, result) => sum + result.estimatedTokens, 0);
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600 bg-green-50';
    if (score >= 0.6) return 'text-yellow-600 bg-yellow-50';
    return 'text-gray-600 bg-gray-50';
  };

  if (!isVisible) return null;

  if (selectedDocumentIds.length === 0) {
    return (
      <div className="mb-3 bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <AlertCircle className="w-4 h-4" />
          <p>Select documents to see context preview</p>
        </div>
      </div>
    );
  }

  if (query.length < minQueryLength) {
    return (
      <div className="mb-3 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-sm text-blue-700">
          <Search className="w-4 h-4" />
          <p>Type at least {minQueryLength} characters to see preview</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-3 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-white bg-opacity-60 border-b border-purple-200">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-purple-600" />
          <h4 className="text-sm font-medium text-purple-900">
            Context Preview
          </h4>
          {isSearching && (
            <Loader2 className="w-3.5 h-3.5 text-purple-600 animate-spin" />
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Token Count */}
          {results.length > 0 && (
            <div className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">
              ~{getTotalTokens()} tokens
            </div>
          )}

          {/* Toggle Visibility */}
          {onToggleVisibility && (
            <button
              onClick={onToggleVisibility}
              className="p-1 text-purple-600 hover:bg-purple-100 rounded transition-colors"
              title="Hide preview"
            >
              <EyeOff className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-3">
        {isSearching ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <Loader2 className="w-6 h-6 text-purple-600 animate-spin mx-auto mb-2" />
              <p className="text-sm text-gray-600">Searching documents...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <p>{error}</p>
          </div>
        ) : results.length === 0 ? (
          <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <p>No relevant context found in selected documents</p>
          </div>
        ) : (
          <div className="space-y-2">
            {results.map((result, index) => (
              <div
                key={`${result.documentId}-${index}`}
                className="bg-white border border-purple-200 rounded-lg p-3 hover:border-purple-300 transition-colors"
              >
                {/* Document Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <FileText className="w-4 h-4 text-purple-600 flex-shrink-0" />
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {result.documentName}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-xs font-medium text-purple-600">
                    <TrendingUp className="w-3 h-3" />
                    {result.matchingChunks.length} chunk{result.matchingChunks.length !== 1 ? 's' : ''}
                  </div>
                </div>

                {/* Matching Chunks */}
                <div className="space-y-2">
                  {result.matchingChunks.map((chunk, chunkIndex) => (
                    <div key={chunkIndex} className="bg-gray-50 rounded p-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-500">
                          Chunk #{chunk.chunkIndex + 1}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${getScoreColor(chunk.score)}`}>
                          {(chunk.score * 100).toFixed(0)}% match
                        </span>
                      </div>
                      <p className="text-xs text-gray-700 line-clamp-3">
                        {chunk.content}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Token Estimate */}
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200">
                  <p className="text-xs text-gray-600">
                    Estimated tokens: {result.estimatedTokens}
                  </p>
                </div>
              </div>
            ))}

            {/* Summary */}
            <div className="bg-purple-100 border border-purple-200 rounded-lg p-3 mt-3">
              <div className="flex items-start gap-2">
                <Eye className="w-4 h-4 text-purple-700 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-purple-900">
                  <p className="font-medium mb-1">This context will be included in your message</p>
                  <p className="text-purple-700">
                    The AI will use these {results.reduce((sum, r) => sum + r.matchingChunks.length, 0)} chunk
                    {results.reduce((sum, r) => sum + r.matchingChunks.length, 0) !== 1 ? 's' : ''} 
                    {' '}(~{getTotalTokens()} tokens) to provide more accurate responses.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

