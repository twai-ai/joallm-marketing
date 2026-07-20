import React, { useState, useEffect } from 'react';
import { FileText, Plus, X, Lightbulb, TrendingUp } from 'lucide-react';
import { Document } from '../../types';

interface SuggestedDocument {
  document: Document;
  relevanceScore: number;
  reason: string;
  matchingKeywords: string[];
}

interface AttachmentSuggestionsProps {
  query: string;
  availableDocuments: Document[];
  selectedDocumentIds: string[];
  onAttach: (documentId: string) => void;
  onDismiss: () => void;
  minQueryLength?: number;
}

export function AttachmentSuggestions({
  query,
  availableDocuments,
  selectedDocumentIds,
  onAttach,
  onDismiss,
  minQueryLength = 10,
}: AttachmentSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<SuggestedDocument[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    if (query.length < minQueryLength) {
      setSuggestions([]);
      return;
    }

    analyzeSuggestions();
  }, [query, availableDocuments, minQueryLength]);

  const analyzeSuggestions = async () => {
    setIsAnalyzing(true);

    // Simulate AI analysis (in production, this would call the backend)
    await new Promise(resolve => setTimeout(resolve, 500));

    const analyzed = analyzeDocumentRelevance(query, availableDocuments, selectedDocumentIds);
    setSuggestions(analyzed.slice(0, 3)); // Top 3 suggestions

    setIsAnalyzing(false);
  };

  // Simple relevance scoring based on keyword matching
  // In production, this would use semantic similarity via embeddings
  const analyzeDocumentRelevance = (
    query: string,
    documents: Document[],
    selected: string[]
  ): SuggestedDocument[] => {
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);

    const scored = documents
      .filter(doc => !selected.includes(doc.id)) // Exclude already selected
      .map(doc => {
        const docText = [
          doc.name,
          doc.metadata?.title || '',
          doc.metadata?.description || '',
          ...(doc.metadata?.tags || []),
        ].join(' ').toLowerCase();

        // Calculate relevance score
        let score = 0;
        const matchingKeywords: string[] = [];

        queryWords.forEach(word => {
          if (docText.includes(word)) {
            score += 10;
            matchingKeywords.push(word);
          }
        });

        // Bonus for title/tag matches
        const titleLower = (doc.metadata?.title || doc.name).toLowerCase();
        queryWords.forEach(word => {
          if (titleLower.includes(word)) {
            score += 20;
          }
        });

        // Bonus for category match
        if (doc.metadata?.category) {
          const category = doc.metadata.category.toLowerCase();
          queryWords.forEach(word => {
            if (category.includes(word)) {
              score += 15;
            }
          });
        }

        // Generate reason for suggestion
        const reason = generateReason(doc, matchingKeywords, queryWords);

        return {
          document: doc,
          relevanceScore: score,
          reason,
          matchingKeywords: matchingKeywords.slice(0, 3),
        };
      })
      .filter(item => item.relevanceScore > 0)
      .sort((a, b) => b.relevanceScore - a.relevanceScore);

    return scored;
  };

  const generateReason = (doc: Document, matchingKeywords: string[], queryWords: string[]): string => {
    if (matchingKeywords.length === 0) return 'Related content';

    const titleMatch = matchingKeywords.some(kw =>
      (doc.metadata?.title || doc.name).toLowerCase().includes(kw)
    );

    if (titleMatch) {
      return `Title mentions "${matchingKeywords[0]}"`;
    }

    if (doc.metadata?.tags && doc.metadata.tags.some(tag => matchingKeywords.includes(tag.toLowerCase()))) {
      return `Tagged with "${matchingKeywords[0]}"`;
    }

    if (doc.metadata?.description && matchingKeywords.some(kw => doc.metadata?.description?.toLowerCase().includes(kw))) {
      return `Description mentions "${matchingKeywords[0]}"`;
    }

    if (doc.metadata?.category) {
      const categoryLower = doc.metadata.category.toLowerCase();
      const matchingCategory = queryWords.find(w => categoryLower.includes(w));
      if (matchingCategory) {
        return `Category: ${doc.metadata.category}`;
      }
    }

    return `Contains keywords: ${matchingKeywords.slice(0, 2).join(', ')}`;
  };

  if (query.length < minQueryLength || suggestions.length === 0) {
    return null;
  }

  return (
    <div className="mb-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-blue-600" />
          <h4 className="text-sm font-medium text-blue-900">
            {isAnalyzing ? 'Analyzing documents...' : 'Suggested Documents'}
          </h4>
        </div>
        <button
          onClick={onDismiss}
          className="p-1 text-blue-600 hover:bg-blue-100 rounded transition-colors"
          title="Dismiss suggestions"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {isAnalyzing ? (
        <div className="flex items-center justify-center py-4">
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
          {suggestions.map(({ document, relevanceScore, reason, matchingKeywords }) => (
            <div
              key={document.id}
              className="flex items-center gap-2 p-2 bg-white border border-blue-200 rounded-lg hover:border-blue-300 transition-colors"
            >
              {/* Document Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {document.metadata?.title || document.name}
                  </p>
                  
                  {/* Relevance Score */}
                  <div className="flex items-center gap-1 text-xs text-blue-600 flex-shrink-0">
                    <TrendingUp className="w-3 h-3" />
                    <span>{relevanceScore}%</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <p className="text-xs text-gray-600">{reason}</p>
                  
                  {/* Matching Keywords */}
                  {matchingKeywords.length > 0 && (
                    <div className="flex gap-1">
                      {matchingKeywords.slice(0, 2).map(keyword => (
                        <span
                          key={keyword}
                          className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs"
                        >
                          {keyword}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Attach Button */}
              <button
                onClick={() => onAttach(document.id)}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs font-medium flex-shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Attach</span>
              </button>
            </div>
          ))}

          {/* Info Text */}
          <p className="text-xs text-blue-700 mt-2">
            💡 These suggestions are based on your query keywords and document metadata
          </p>
        </div>
      )}
    </div>
  );
}

