// Custom hook for document/file operations
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../utils/api-client';
import { API_ENDPOINTS } from '../config/api';
import { Document } from '../types';
import { showSuccess, showError } from '../utils/toast';

export function useDocuments() {
  const queryClient = useQueryClient();

  // Fetch all documents
  const { data: documentsResponse, isLoading, error, refetch } = useQuery({
    queryKey: ['documents'],
    queryFn: async () => {
      return await apiClient.get<{files: Document[], pagination: any}>(API_ENDPOINTS.files.list);
    },
  });

  // Upload document mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      return await apiClient.uploadFile<Document>(
        API_ENDPOINTS.files.upload,
        file
      );
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      const fileName = data.name || data.filename || data.originalName || 'Document';
      showSuccess(`${fileName} uploaded successfully`);
    },
    onError: (error: any) => {
      showError('Failed to upload document', error.message);
    },
  });

  // Delete document mutation
  const deleteMutation = useMutation({
    mutationFn: async (documentId: string) => {
      await apiClient.delete(API_ENDPOINTS.files.delete(documentId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      showSuccess('Document deleted successfully');
    },
    onError: () => {
      showError('Failed to delete document');
    },
  });

  // Reindex document for RAG
  const reindexMutation = useMutation({
    mutationFn: async (documentId: string) => {
      return await apiClient.post(API_ENDPOINTS.rag.reindex(documentId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      showSuccess('Document reindexed successfully');
    },
    onError: () => {
      showError('Failed to reindex document');
    },
  });

  // Upload multiple files
  const uploadMultiple = async (files: File[]) => {
    const results = [];
    for (const file of files) {
      try {
        const result = await uploadMutation.mutateAsync(file);
        results.push(result);
      } catch (error) {
        console.error(`Failed to upload ${file.name}:`, error);
      }
    }
    return results;
  };

  return {
    documents: documentsResponse?.files || [],
    isLoading,
    error,
    refetch,
    upload: uploadMutation.mutate,
    uploadMultiple,
    deleteDocument: deleteMutation.mutate,
    reindex: reindexMutation.mutate,
    isUploading: uploadMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}


