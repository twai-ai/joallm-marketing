import { useState, useEffect } from 'react';
import { apiClient } from '../utils/api-client';

export interface SuggestedQuestion {
  question: string;
  category: string;
  relevance: string;
  icon: string;
}

export interface RAGSuggestionsResponse {
  questions: SuggestedQuestion[];
  totalDocuments: number;
  documentsAnalyzed: string[];
}

export function useRAGSuggestions(documentIds?: string[], limit: number = 3) {
  const [questions, setQuestions] = useState<SuggestedQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [totalDocuments, setTotalDocuments] = useState(0);

  useEffect(() => {
    fetchSuggestions();
  }, [documentIds?.join(','), limit]);

  const fetchSuggestions = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await apiClient.post<RAGSuggestionsResponse>(
        '/api/rag/suggested-questions',
        {
          documentIds,
          limit
        }
      );

      setQuestions(response.questions);
      setTotalDocuments(response.totalDocuments);
    } catch (err) {
      console.error('Failed to fetch RAG suggestions:', err);
      setError(err as Error);
      
      // Fallback to default questions if API fails
      setQuestions([
        {
          question: "What does this documentation cover?",
          category: "General",
          relevance: "Understanding available documentation",
          icon: "📚"
        },
        {
          question: "How do I get started?",
          category: "Getting Started",
          relevance: "First steps",
          icon: "🚀"
        },
        {
          question: "What are the main features?",
          category: "General",
          relevance: "Overview of capabilities",
          icon: "⭐"
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshSuggestions = () => {
    fetchSuggestions();
  };

  return {
    questions,
    isLoading,
    error,
    totalDocuments,
    refreshSuggestions
  };
}

