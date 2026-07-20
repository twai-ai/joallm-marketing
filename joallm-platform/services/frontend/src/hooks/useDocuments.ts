// Custom hook for document/file operations
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../utils/api-client';
import { API_ENDPOINTS } from '../config/api';
import { Document } from '../types';
import { showSuccess, showError, showWarning, showInfo } from '../utils/toast';
import { getFileExtension, getFormatStatus } from '../utils/fileValidation';
import { parseBackendError } from '../utils/errorMessages';
import { mapBackendFileToKnowledgeDocument } from '../domain/knowledge';

interface UploadedDocumentResponse extends Document {
  fileId?: string;
  message?: string;
  supported?: 'supported' | 'beta' | 'coming-soon';
  warning?: string;
  url?: string;
}

interface FileStatusResponse {
  id: string;
  status: string;
  chunks?: number;
  error?: string;
}

interface DeleteDocumentResponse {
  success: boolean;
  message: string;
  storageCleanupWarning?: string;
}

export function useDocuments() {
  const queryClient = useQueryClient();

  // Fetch all documents (increased limit to 100)
  const { data: documentsResponse, isLoading, error, refetch } = useQuery({
    queryKey: ['documents'],
    queryFn: async () => {
      return await apiClient.get<{files: Document[], pagination: any}>(`${API_ENDPOINTS.files.list}?limit=100`);
    },
  });

  // Upload document mutation
  const uploadMutation = useMutation({
    mutationFn: async ({ file, storeOriginal = false }: { file: File; storeOriginal?: boolean }) => {
      return await apiClient.uploadFile<UploadedDocumentResponse>(
        API_ENDPOINTS.files.upload,
        file,
        { storeOriginal: storeOriginal.toString() } // Pass as string for FormData
      );
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      const fileName = data.name || data.filename || data.originalName || 'Document';
      const fileExtension = getFileExtension(fileName);
      const formatStatus = getFormatStatus(fileExtension);
      const backendStatus = data.supported;
      const backendWarning = data.warning;
      
      // Show different messages based on format status
      if (backendWarning) {
        showWarning(`${fileName} uploaded. ${backendWarning}`);
      } else if (backendStatus === 'beta' || formatStatus === 'beta') {
        showWarning(`${fileName} uploaded. Text extraction is in beta - search may be limited.`);
      } else {
        showSuccess(`${fileName} uploaded successfully. Document is being indexed for search...`);
      }
      
      // Check indexing status after a delay
      // Fix: Ensure we have a valid file ID
      const fileId = data.id || data.fileId;
      if (fileId) {
        setTimeout(async () => {
          try {
            const status = await apiClient.get<FileStatusResponse>(API_ENDPOINTS.files.status(fileId));
            const isIndexed = status.status === 'processed' || status.status === 'ready' || (status.chunks ?? 0) > 0;

            if (isIndexed) {
              if (backendStatus === 'beta' || formatStatus === 'beta') {
                showSuccess(`${fileName} indexed. Note: Beta format may have incomplete text extraction.`);
              } else {
                showSuccess(`${fileName} is now available for semantic search!`);
              }
            } else if (status.status === 'failed') {
              showError('Document processing failed', status.error || `${fileName} could not be processed.`);
            } else {
              showSuccess(`${fileName} indexing in progress. It will be available for search shortly.`);
            }
          } catch (error) {
            // Only log in development
            if (import.meta.env.DEV) {
              console.warn('Could not check indexing status:', error);
            }
          }
        }, 2000);
      }
    },
    onError: (error: any) => {
      const errorInfo = parseBackendError(error);
      showError(errorInfo.title, errorInfo.message);
    },
  });

  // Delete document mutation
  const deleteMutation = useMutation({
    mutationFn: async (documentId: string) => {
      return await apiClient.delete<DeleteDocumentResponse>(API_ENDPOINTS.files.delete(documentId));
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      if (response?.storageCleanupWarning) {
        showWarning(response.storageCleanupWarning);
      } else {
        showSuccess(response?.message || 'Document deleted successfully');
      }
    },
    onError: () => {
      showError('Failed to delete document');
    },
  });

  // Reindex document for RAG
  const reindexMutation = useMutation({
    mutationFn: async (documentId: string) => {
      return await apiClient.post(API_ENDPOINTS.files.reprocess(documentId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      showSuccess('Document reprocessing started successfully');
    },
    onError: () => {
      showError('Failed to reprocess document');
    },
  });

  // Upload multiple files with progress tracking
  const uploadMultiple = async (files: File[], storeOriginal = false) => {
    const results = [];
    const errors: Array<{ file: string; error: string }> = [];
    let successCount = 0;

    if (files.length === 1) {
      showInfo(`Upload in progress: ${files[0].name}`);
    } else if (files.length > 1) {
      showInfo(`Upload in progress: ${files.length} files selected`);
    }
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        // Show progress for bulk uploads
        if (files.length > 1) {
          showSuccess(`Uploading file ${i + 1} of ${files.length}: ${file.name}...`);
        }
        
        const result = await uploadMutation.mutateAsync({ file, storeOriginal });
        results.push(result);
        successCount++;
        } catch (error: any) {
        // Only log in development
        if (import.meta.env.DEV) {
          console.error(`Failed to upload ${file.name}:`, error);
        }
        const errorInfo = parseBackendError(error);
        errors.push({ file: file.name, error: errorInfo.message });
      }
    }
    
    // Show summary for multiple files
    if (files.length > 1) {
      if (errors.length === 0) {
        showSuccess(`All ${successCount} files uploaded successfully!`);
      } else if (successCount > 0) {
        showWarning(`${successCount} files uploaded. ${errors.length} failed: ${errors.map(e => e.file).join(', ')}`);
      } else {
        showError('Upload failed', `All ${files.length} files failed to upload. Please try again.`);
      }
    }
    
    return results;
  };

  return {
    documents: (documentsResponse?.files || []).map(mapBackendFileToKnowledgeDocument),
    isLoading,
    error,
    refetch,
    upload: (file: File, storeOriginal = false) => uploadMutation.mutate({ file, storeOriginal }),
    uploadMultiple,
    deleteDocument: deleteMutation.mutate,
    reindex: reindexMutation.mutate,
    reprocess: reindexMutation.mutate,
    isUploading: uploadMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
