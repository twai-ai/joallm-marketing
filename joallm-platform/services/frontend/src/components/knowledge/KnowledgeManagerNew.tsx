import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Upload, File, Search, Trash2, Download, Eye, RefreshCw, Plus, CheckCircle, AlertCircle, Clock, BarChart3, Settings, Zap, Loader2, Info, TrendingUp, Hash, Calendar, FileText, ChevronDown, ChevronRight, Film } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { showError } from '../../utils/toast';
import { useDocuments } from '../../hooks/useDocuments';
import { useRAG } from '../../hooks/useRAG';
import { DocumentListSkeleton } from '../common/LoadingSkeleton';
import { DocumentPreviewModal } from '../common/DocumentPreviewModal';
import { RAGAnalyticsDashboard } from '../rag/RAGAnalyticsDashboard';
import { AdvancedSearchPanel } from '../rag/AdvancedSearchPanel';
import { RAGConfigurationPanel } from '../rag/RAGConfigurationPanel';
import { FileStatusBadge } from './FileStatusBadge';
import { FileProcessingStages } from './FileProcessingStages';
import { ReprocessButton } from './ReprocessButton';
import { BulkActionToolbar } from './BulkActionToolbar';
import { BulkDeleteConfirmModal } from './BulkDeleteConfirmModal';
import { DocumentFilters, FilterOptions } from './DocumentFilters';
import { apiClient } from '../../utils/api-client';
import { API_ENDPOINTS } from '../../config/api';
import { ClearAndUploadModal } from './ClearAndUploadModal';
import type { Document } from '../../types';
import { KnowledgeDocumentCard } from '../entities/KnowledgeDocumentCard';
import { KnowledgeStatusBadge } from '../entities/KnowledgeStatusBadge';
import { SourceChunkCard } from '../entities/SourceChunkCard';

interface KnowledgeManagerNewProps {
  isOpen: boolean;
  onClose: () => void;
  inline?: boolean; // New prop to render inline instead of as modal
}

// Utility function to highlight keywords in text
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

// Utility function to generate citation format
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

export function KnowledgeManagerNew({ isOpen, onClose, inline = false }: KnowledgeManagerNewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [ragQuery, setRagQuery] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{[key: string]: number}>({});
  const [previewDocument, setPreviewDocument] = useState<Document | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [showConfiguration, setShowConfiguration] = useState(false);
  const [expandedDocuments, setExpandedDocuments] = useState<Set<string>>(new Set());
  const [storeOriginal, setStoreOriginal] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [showClearAndUpload, setShowClearAndUpload] = useState(false);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    status: [],
    dateRange: { start: null, end: null },
    fileTypes: [],
    sortBy: 'date',
    sortOrder: 'desc'
  });
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleExpanded = (docId: string) => {
    setExpandedDocuments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(docId)) {
        newSet.delete(docId);
      } else {
        newSet.add(docId);
      }
      return newSet;
    });
  };

  const {
    documents,
    isLoading,
    refetch,
    upload,
    uploadMultiple,
    deleteDocument,
    reindex,
    isUploading,
  } = useDocuments();

  const { search, searchResults, isSearching } = useRAG();
  const navigate = useNavigate();
  const handleMigrateToStorage = async (doc: { id: string }) => {
    try {
      await apiClient.post(API_ENDPOINTS.files.migrateStorage(doc.id), {});
      await refetch();
    } catch {
      showError('Failed to migrate file to object storage');
    }
  };

  const handleOpenInMediaLab = (doc: { id: string }) => {
    navigate(`/studio/media-ai/${doc.id}`);
  };

  // Create RAG search session when component mounts
  useEffect(() => {
    const createSession = async () => {
      try {
        const response = await apiClient.post(API_ENDPOINTS.rag.sessions, {
          title: 'Knowledge Manager Search',
          searchType: 'hybrid',
        });
        setCurrentSessionId(response.id);
      } catch (error) {
        console.warn('Failed to create RAG search session:', error);
      }
    };
    
    if (isOpen && !currentSessionId) {
      createSession();
    }
  }, [isOpen, currentSessionId]);

  // Auto-refresh documents list every 5 seconds if there are processing documents
  useEffect(() => {
    const hasProcessingDocs = documents.some(doc => 
      doc.status === 'processing' || doc.status === 'uploaded'
    );
    
    if (hasProcessingDocs) {
      const interval = setInterval(() => {
        refetch();
      }, 5000); // Refresh every 5 seconds
      
      return () => clearInterval(interval);
    }
  }, [documents, refetch]);

  // Enhanced filtering and sorting (moved before useEffect to avoid initialization errors)
  const filteredDocuments = documents
    .filter((doc) => {
      const docName = doc.name || doc.filename || doc.originalName || '';
      
      // Text search filter
      if (searchTerm && !docName.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      
      // Status filter
      if (filters.status.length > 0 && !filters.status.includes(doc.status || '')) {
        return false;
      }
      
      // File type filter
      if (filters.fileTypes.length > 0) {
        const ext = docName.split('.').pop()?.toLowerCase();
        if (!ext || !filters.fileTypes.includes(ext)) {
          return false;
        }
      }
      
      // Date range filter
      if (filters.dateRange.start || filters.dateRange.end) {
        const docDate = new Date(doc.createdAt || doc.uploadedAt || Date.now());
        if (filters.dateRange.start && docDate < filters.dateRange.start) {
          return false;
        }
        if (filters.dateRange.end && docDate > filters.dateRange.end) {
          return false;
        }
      }
      
      return true;
    })
    .sort((a, b) => {
      const getCompareValue = (doc: any) => {
        switch (filters.sortBy) {
          case 'name':
            return (doc.name || doc.filename || doc.originalName || '').toLowerCase();
          case 'date':
            return new Date(doc.createdAt || doc.uploadedAt || 0).getTime();
          case 'size':
            return doc.size || 0;
          case 'status':
            return doc.status || '';
          default:
            return '';
        }
      };
      
      const aVal = getCompareValue(a);
      const bVal = getCompareValue(b);
      
      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return filters.sortOrder === 'asc' ? comparison : -comparison;
    });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready':
      case 'processed':
        return 'bg-green-100 text-green-800';
      case 'processing':
      case 'uploaded':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ready':
      case 'processed':
        return <CheckCircle className="w-3 h-3" />;
      case 'processing':
      case 'uploaded':
        return <Loader2 className="w-3 h-3 animate-spin" />;
      case 'failed':
        return <AlertCircle className="w-3 h-3" />;
      default:
        return <Clock className="w-3 h-3" />;
    }
  };

  const getFileIcon = () => {
    return <File className="w-5 h-5 text-gray-400" />;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;


    try {
      await uploadMultiple(files, storeOriginal);
    } catch (error) {
      console.error('Upload failed:', error);
    }

    // Clear the input
    if (e.target) {
      e.target.value = '';
    }
  };

  const handleUploadClick = () => {
    if (fileInputRef.current && !isUploading) {
      fileInputRef.current.click();
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    // Comprehensive list of supported file types (matching validation.ts)
    const allowedTypes = [
      // PDF documents
      'application/pdf',
      // Text documents
      'text/plain', 'text/markdown', 'text/x-markdown', 'application/markdown',
      'text/csv', 'text/html', 'text/xml', 'application/xml', 'text/rtf', 'application/rtf',
      // Microsoft Office documents
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-powerpoint',
      // OpenDocument formats
      'application/vnd.oasis.opendocument.text',
      'application/vnd.oasis.opendocument.spreadsheet',
      'application/vnd.oasis.opendocument.presentation',
      // Images
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
      'image/bmp', 'image/tiff', 'image/svg+xml',
      // Archives
      'application/zip', 'application/x-zip-compressed',
      'application/x-rar-compressed', 'application/x-7z-compressed',
      // JSON and data formats
      'application/json', 'application/yaml', 'text/yaml'
    ];

    // Filter for supported file types
    const supportedFiles = files.filter(file => {
      const fileName = file.name.toLowerCase();
      const fileType = file.type.toLowerCase();
      
      // Check MIME type
      if (allowedTypes.includes(fileType)) return true;
      
      // Check file extension for text/markdown variants
      if (fileType.startsWith('text/') || 
          fileName.endsWith('.md') || 
          fileName.endsWith('.markdown') ||
          fileName.endsWith('.txt') ||
          fileName.endsWith('.csv') ||
          fileName.endsWith('.json') ||
          fileName.endsWith('.yaml') ||
          fileName.endsWith('.yml')) {
        return true;
      }
      
      // Check by extension for common formats
      const ext = fileName.split('.').pop();
      const allowedExtensions = [
        'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
        'odt', 'ods', 'odp', 'txt', 'md', 'markdown', 'csv',
        'html', 'xml', 'rtf', 'jpg', 'jpeg', 'png', 'gif',
        'webp', 'bmp', 'tiff', 'svg', 'json', 'yaml', 'yml'
      ];
      
      return ext ? allowedExtensions.includes(ext) : false;
    });

    if (supportedFiles.length === 0) {
      alert('Please upload supported files: PDF, Word, Excel, PowerPoint, Text, Markdown, CSV, Images (JPEG, PNG, GIF, WebP), or JSON/YAML files.');
      return;
    }

    try {
      await uploadMultiple(supportedFiles);
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };

  // Enhanced bulk operations (wrapped in useCallback to prevent re-renders)
  const handleBulkDelete = useCallback(() => {
    if (selectedDocuments.length === 0) return;
    setShowBulkDeleteConfirm(true);
  }, [selectedDocuments.length]);

  const confirmBulkDelete = useCallback(async () => {
    setIsBulkProcessing(true);
    try {
      for (const docId of selectedDocuments) {
        await deleteDocument(docId);
      }
      setSelectedDocuments([]);
      setShowBulkDeleteConfirm(false);
    } finally {
      setIsBulkProcessing(false);
    }
  }, [selectedDocuments, deleteDocument]);

  const handleBulkReindex = useCallback(async () => {
    if (selectedDocuments.length === 0) return;
    
    setIsBulkProcessing(true);
    try {
      for (const docId of selectedDocuments) {
        await reindex(docId);
      }
      await refetch();
    } finally {
      setIsBulkProcessing(false);
    }
  }, [selectedDocuments, reindex, refetch]);

  const handleBulkDownload = useCallback(() => {
    if (selectedDocuments.length === 0) return;
    
    const selectedDocs = documents.filter(doc => selectedDocuments.includes(doc.id));
    const data = JSON.stringify(selectedDocs, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `documents-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [selectedDocuments, documents]);

  const handleSelectAll = useCallback(() => {
    if (selectedDocuments.length === filteredDocuments.length) {
      setSelectedDocuments([]);
    } else {
      setSelectedDocuments(filteredDocuments.map(doc => doc.id));
    }
  }, [selectedDocuments.length, filteredDocuments]);

  const handleDeselectAll = useCallback(() => {
    setSelectedDocuments([]);
  }, []);

  const handleInvertSelection = useCallback(() => {
    const allIds = filteredDocuments.map(doc => doc.id);
    const newSelection = allIds.filter(id => !selectedDocuments.includes(id));
    setSelectedDocuments(newSelection);
  }, [filteredDocuments, selectedDocuments]);

  const handleSelectByStatus = useCallback((status: string) => {
    const docsWithStatus = filteredDocuments
      .filter(doc => doc.status === status)
      .map(doc => doc.id);
    setSelectedDocuments(docsWithStatus);
  }, [filteredDocuments]);

  const handleClearAll = useCallback(async () => {
    setIsBulkProcessing(true);
    try {
      for (const doc of documents) {
        await deleteDocument(doc.id);
      }
      await refetch();
    } finally {
      setIsBulkProcessing(false);
    }
  }, [documents, deleteDocument, refetch]);

  // Keyboard shortcuts (placed after handler functions are defined)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger if modal is open
      if (!isOpen) return;
      
      // Ctrl/Cmd + A: Select all
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        handleSelectAll();
      }
      
      // Ctrl/Cmd + D: Deselect all
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        handleDeselectAll();
      }
      
      // Delete key: Delete selected (if any selected)
      if (e.key === 'Delete' && selectedDocuments.length > 0) {
        e.preventDefault();
        handleBulkDelete();
      }
      
      // Ctrl/Cmd + I: Invert selection
      if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
        e.preventDefault();
        handleInvertSelection();
      }
      
      // Escape: Close modals or deselect
      if (e.key === 'Escape') {
        if (selectedDocuments.length > 0) {
          handleDeselectAll();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedDocuments.length, handleSelectAll, handleDeselectAll, handleBulkDelete, handleInvertSelection]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this document?')) {
      deleteDocument(id);
      setSelectedDocuments((prev) => prev.filter((docId) => docId !== id));
    }
  };

  const handleSelectDocument = (id: string) => {
    setSelectedDocuments((prev) =>
      prev.includes(id) ? prev.filter((docId) => docId !== id) : [...prev, id]
    );
  };

  const handleRAGSearch = async () => {
    if (!ragQuery.trim()) return;
    await search(ragQuery, {
      documentIds: selectedDocuments.length > 0 ? selectedDocuments : undefined,
      sessionId: currentSessionId || undefined,
    });
  };

  const formatDate = (date: Date) => {
    try {
      const d = new Date(date);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return 'Unknown';
    }
  };

  if (!isOpen) return null;

  // Render as modal overlay
  if (!inline) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl h-5/6 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-joa-primary to-joa-accent">
          <div>
            <h2 className="text-xl font-semibold text-white">JoaLLM Knowledge Base</h2>
            <p className="text-sm text-white/90 mt-1">
              Manage documents and perform semantic search with RAG
            </p>
          </div>
          <div className="flex items-center space-x-2">
            {/* Refresh Button */}
            <button
              onClick={() => refetch()}
              className="flex items-center space-x-2 px-3 py-2 text-sm bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors backdrop-blur-sm"
              title="Refresh Documents"
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            
            {/* Advanced RAG Features */}
            <button
              onClick={() => setShowAnalytics(true)}
              className="flex items-center space-x-2 px-3 py-2 text-sm bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors backdrop-blur-sm"
              title="RAG Analytics Dashboard"
            >
              <BarChart3 className="w-4 h-4" />
              <span>Analytics</span>
            </button>
            <button
              onClick={() => setShowAdvancedSearch(true)}
              className="flex items-center space-x-2 px-3 py-2 text-sm bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors backdrop-blur-sm"
              title="Advanced Search"
            >
              <Zap className="w-4 h-4" />
              <span>Advanced</span>
            </button>
            <button
              onClick={() => setShowConfiguration(true)}
              className="flex items-center space-x-2 px-3 py-2 text-sm bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors backdrop-blur-sm"
              title="RAG Configuration"
            >
              <Settings className="w-4 h-4" />
              <span>Config</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left Panel - Documents */}
          <div className="flex-1 flex flex-col border-r border-gray-200">
            {/* Bulk Action Toolbar */}
            <BulkActionToolbar
              selectedCount={selectedDocuments.length}
              totalCount={filteredDocuments.length}
              onSelectAll={handleSelectAll}
              onDeselectAll={handleDeselectAll}
              onBulkDelete={handleBulkDelete}
              onBulkReindex={handleBulkReindex}
              onBulkDownload={handleBulkDownload}
              onSelectByStatus={handleSelectByStatus}
              onInvertSelection={handleInvertSelection}
              isProcessing={isBulkProcessing}
            />

            {/* Document Filters */}
            <DocumentFilters
              filters={filters}
              onChange={setFilters}
              documentCount={documents.length}
              filteredCount={filteredDocuments.length}
            />

            {/* Toolbar */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center space-x-3 flex-wrap gap-2">
                <div className="relative">
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.txt,.docx,.csv,.md,.markdown,.doc,.jpg,.jpeg,.png,.gif,.webp,.bmp,.tiff,.svg,.json,.yaml,.yml,.js,.ts,.tsx,.jsx,.py,.go,.rs,.sql"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                    disabled={isUploading}
                  />
                  <label
                    htmlFor="file-upload"
                    className={`flex items-center space-x-2 px-4 py-2 bg-joa-primary hover:bg-red-800 text-white rounded-lg cursor-pointer transition-colors ${
                      isUploading ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <Upload className="w-4 h-4" />
                    <span>{isUploading ? 'Uploading...' : 'Upload Documents'}</span>
                  </label>
                </div>

                {/* Clear All & Upload New Button */}
                <button
                  onClick={() => setShowClearAndUpload(true)}
                  disabled={isUploading || documents.length === 0}
                  className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Delete all documents and upload new ones"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Clear All & Upload New</span>
                </button>

                {/* Storage Option Checkbox */}
                <div className="flex items-center space-x-2 text-sm text-gray-600 bg-white px-3 py-2 rounded-lg border border-gray-300">
                  <input
                    type="checkbox"
                    id="store-original"
                    checked={storeOriginal}
                    onChange={(e) => setStoreOriginal(e.target.checked)}
                    className="w-4 h-4 text-joa-primary border-gray-300 rounded focus:ring-joa-primary"
                  />
                  <label htmlFor="store-original" className="cursor-pointer select-none flex items-center space-x-1">
                    <span>Store original files</span>
                    <span className="text-xs text-gray-500">(download enabled)</span>
                  </label>
                </div>

                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search documents..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-joa-primary focus:border-joa-primary"
                  />
                </div>
              </div>

              <div className="text-sm text-gray-600">
                {documents.length} documents • {selectedDocuments.length} selected
              </div>
            </div>

            {/* Document List */}
            <div className="flex-1 overflow-y-auto p-4">
              {isLoading ? (
                <DocumentListSkeleton count={5} />
              ) : filteredDocuments.length === 0 ? (
                <div className="text-center py-12">
                  <File className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No documents found</h3>
                  <p className="text-gray-600 mb-4">
                    {searchTerm
                      ? 'Try adjusting your search terms'
                      : 'Upload documents to get started with AI-powered analysis'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredDocuments.map((document) => (
                    <div
                      key={document.id}
                      className={`border rounded-lg hover:bg-gray-50 transition-colors ${
                        selectedDocuments.includes(document.id) ? 'bg-blue-50 border-blue-200' : 'border-gray-200'
                      }`}
                    >
                      {/* Main Document Row */}
                      <div className="flex items-center space-x-4 p-4">
                        <input
                          type="checkbox"
                          checked={selectedDocuments.includes(document.id)}
                          onChange={() => handleSelectDocument(document.id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />

                        <div className="flex-shrink-0">{getFileIcon()}</div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium text-gray-900 truncate">
                              {document.displayName}
                            </h3>
                            <KnowledgeStatusBadge status={document.status} />
                          </div>

                          <div className="flex items-center space-x-4 mt-1 text-xs text-gray-500">
                            <span>{(document.size / 1024).toFixed(1)} KB</span>
                            <span>•</span>
                            <span>{formatDate(document.uploadedAt || document.uploadDate || new Date())}</span>
                            {document.chunks && (
                              <>
                                <span>•</span>
                                <span>{document.chunks} chunks</span>
                              </>
                            )}
                            {(document.mimeType?.startsWith('video/') || document.mimeType?.startsWith('audio/')) && document.status === 'processed' && (
                              <>
                                <span>•</span>
                                <span className="font-medium text-violet-600">Transcript indexed</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          {/* Expand/Collapse Button */}
                          <button
                            onClick={() => toggleExpanded(document.id)}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            title={expandedDocuments.has(document.id) ? "Hide details" : "Show processing details"}
                          >
                            {expandedDocuments.has(document.id) ? (
                              <ChevronDown className="w-4 h-4 text-gray-400" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-gray-400" />
                            )}
                          </button>

                          <button
                            onClick={() => setPreviewDocument(document)}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Preview document"
                          >
                            <Eye className="w-4 h-4 text-gray-400" />
                          </button>

                          <ReprocessButton
                            fileId={document.id}
                            filename={document.displayName || document.name || document.filename || 'document'}
                            onReprocessComplete={() => refetch()}
                            size="sm"
                            variant="ghost"
                          />

                          {document.storageProvider === 'volume' && (
                            <button
                              onClick={() => handleMigrateToStorage(document)}
                              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                              title="Move to object storage"
                            >
                              <Upload className="w-4 h-4 text-amber-500" />
                            </button>
                          )}

                          {(document.mimeType?.startsWith('video/') || document.mimeType?.startsWith('audio/')) && (
                            <button
                              onClick={() => handleOpenInMediaLab(document)}
                              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                              title="Open in Media AI"
                            >
                              <Film className="w-4 h-4 text-violet-500" />
                            </button>
                          )}

                          <button
                            onClick={() => handleDelete(document.id)}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Delete document"
                          >
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        </div>
                      </div>

                      {/* Expandable Processing Stages */}
                      {expandedDocuments.has(document.id) && (
                        <div className="px-4 pb-4 border-t border-gray-100 pt-4">
                          <FileProcessingStages 
                            status={document.status as 'uploaded' | 'processing' | 'processed' | 'failed'}
                            error={document.processingError}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - RAG Search */}
          <div className="w-96 flex flex-col bg-gradient-to-b from-gray-50 to-gray-100">
            <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-joa-accent to-joa-primary">
              <h3 className="text-lg font-semibold text-white mb-2">Semantic Search</h3>
              <p className="text-sm text-white/90">Search across your documents using AI</p>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search Query
                </label>
                <textarea
                  value={ragQuery}
                  onChange={(e) => setRagQuery(e.target.value)}
                  placeholder="Enter your search query..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-joa-primary focus:border-joa-primary min-h-[100px]"
                />
              </div>

              <button
                onClick={handleRAGSearch}
                disabled={!ragQuery.trim() || isSearching}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-joa-primary hover:bg-red-800 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Search className="w-4 h-4" />
                <span>{isSearching ? 'Searching...' : 'Search'}</span>
              </button>

              {selectedDocuments.length > 0 && (
                <div className="text-sm text-gray-600 bg-blue-50 p-2 rounded">
                  Searching in {selectedDocuments.length} selected document(s)
                </div>
              )}
            </div>

            {/* Search Results */}
            {searchResults && searchResults.length > 0 ? (
              <div className="flex-1 overflow-y-auto p-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-joa-primary" />
                    Search Results ({searchResults.length})
                  </h4>
                  <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                    Query: "{ragQuery}"
                  </div>
                </div>
                <div className="space-y-4">
                  {searchResults.map((result, index) => (
                    <SourceChunkCard key={result.id} result={result} index={index} />
                  ))}
                </div>
                
                {/* Citations Summary */}
                <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <h5 className="text-sm font-semibold text-blue-900">References & Citations</h5>
                  </div>
                  <div className="space-y-2">
                    {searchResults.map((result, index) => {
                      const metadata = result;
                      const citation = generateCitation(metadata, index);
                      return (
                        <div key={citation.id} className="flex items-center justify-between text-xs bg-white p-2 rounded border">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center text-xs font-bold">
                              {index + 1}
                            </span>
                            <span className="text-blue-800 font-medium">{citation.text}</span>
                            <span className="text-blue-600">•</span>
                            <span className="text-blue-600">Position {citation.position}</span>
                          </div>
                          <button 
                            className="text-blue-600 hover:text-blue-800 transition-colors"
                            onClick={() => {
                              navigator.clipboard?.writeText(citation.fullCitation);
                            }}
                          >
                            Copy Citation
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 text-xs text-blue-700">
                    <p className="font-medium">📚 Academic Citation Format:</p>
                    <p className="mt-1 italic">
                      "JoaLLM Knowledge Base Search Results. Retrieved from {new Date().toLocaleDateString()}. 
                      Query: '{ragQuery}'. {searchResults.length} results found."
                    </p>
                  </div>
                </div>
              </div>
            ) : searchResults && searchResults.length === 0 ? (
              <div className="flex-1 overflow-y-auto p-4">
                <div className="text-center text-gray-500 py-8">
                  <Search className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  <p className="font-medium">No results found for your search query.</p>
                  <p className="text-sm mt-1">Try different keywords or check your spelling.</p>
                  <div className="mt-4 text-xs text-gray-400">
                    <p>💡 Tips for better results:</p>
                    <ul className="mt-2 space-y-1">
                      <li>• Use specific keywords</li>
                      <li>• Try synonyms or related terms</li>
                      <li>• Check if documents are processed</li>
                    </ul>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4 bg-gradient-to-r from-gray-50 to-gray-100">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600 flex items-center gap-2">
              <Info className="w-4 h-4 text-joa-primary" />
              <span>Supported formats: PDF, DOCX, TXT, CSV, MD, DOC, Images, Audio, Video</span>
            </div>

            <div className="flex items-center space-x-3">
              {selectedDocuments.length > 0 && (
                <button
                  onClick={() => {
                    selectedDocuments.forEach(handleDelete);
                  }}
                  className="flex items-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Selected</span>
                </button>
              )}

              <button
                onClick={onClose}
                className="px-4 py-2 bg-joa-primary hover:bg-red-800 text-white rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>

        {/* Document Preview Modal */}
        <DocumentPreviewModal
          document={previewDocument}
          isOpen={!!previewDocument}
          onClose={() => setPreviewDocument(null)}
        />

        {/* RAG Analytics Dashboard */}
        <RAGAnalyticsDashboard
          isOpen={showAnalytics}
          onClose={() => setShowAnalytics(false)}
        />

        {/* Advanced Search Panel */}
        <AdvancedSearchPanel
          isOpen={showAdvancedSearch}
          onClose={() => setShowAdvancedSearch(false)}
          availableDocuments={documents.map(doc => ({ 
            id: doc.id, 
            name: doc.name || doc.filename || doc.originalName || 'Unknown Document' 
          }))}
          onResultsSelect={(results) => {
            // Handle selected results - could integrate with chat or show in a panel
          }}
        />

        {/* RAG Configuration Panel */}
        <RAGConfigurationPanel
          isOpen={showConfiguration}
          onClose={() => setShowConfiguration(false)}
          onConfigSave={(config) => {
          }}
        />
      </div>
    </div>
    );
  }

  // Render inline version (for tabs)
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-joa-primary to-joa-accent">
        <div>
          <h2 className="text-xl font-semibold text-white">JoaLLM Knowledge Base</h2>
          <p className="text-sm text-white/90 mt-1">
            Manage documents and perform semantic search with RAG
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {/* Refresh Button */}
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors disabled:opacity-50"
            title="Refresh documents"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - Document Management */}
        <div className="w-1/2 border-r border-gray-200 flex flex-col">
          {/* Bulk Action Toolbar */}
          <BulkActionToolbar
            selectedCount={selectedDocuments.length}
            totalCount={filteredDocuments.length}
            onSelectAll={handleSelectAll}
            onDeselectAll={handleDeselectAll}
            onBulkDelete={handleBulkDelete}
            onBulkReindex={handleBulkReindex}
            onBulkDownload={handleBulkDownload}
            onSelectByStatus={handleSelectByStatus}
            onInvertSelection={handleInvertSelection}
            isProcessing={isBulkProcessing}
          />

          {/* Document Filters */}
          <DocumentFilters
            filters={filters}
            onChange={setFilters}
            documentCount={documents.length}
            filteredCount={filteredDocuments.length}
          />

          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Documents</h3>
              <div className="flex items-center space-x-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  multiple
                  accept=".pdf,.txt,.docx,.csv,.md,.markdown,.doc,.html,.xml,.rtf,.jpg,.jpeg,.png,.gif,.webp,.bmp,.tiff,.svg,.json,.yaml,.yml,.js,.ts,.tsx,.jsx,.py,.go,.rs,.sql,.java,.c,.cpp,.cs,.php,.rb,.sh"
                  className="hidden"
                  id="file-upload-analytics"
                  disabled={isUploading}
                />
                <button
                  type="button"
                  onClick={handleUploadClick}
                  disabled={isUploading}
                  className={`flex items-center space-x-2 px-3 py-2 bg-joa-primary text-white rounded-lg hover:bg-red-800 transition-colors cursor-pointer text-sm ${
                    isUploading ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  <Plus className="w-4 h-4" />
                  <span>{isUploading ? 'Uploading...' : 'Upload Documents'}</span>
                </button>
              </div>
            </div>

            {/* Storage Option - Info Message */}
            <div className="flex items-center space-x-2 text-sm bg-blue-50 border border-blue-200 px-3 py-2 rounded-lg">
              <Info className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={storeOriginal}
                  onChange={(e) => setStoreOriginal(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-gray-700">
                  Store original files for download {!storeOriginal && <span className="text-gray-500">(process-only mode: faster, no storage used)</span>}
                </span>
              </label>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search documents..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-joa-primary focus:border-joa-primary"
              />
            </div>

            <div className="text-sm text-gray-600 mt-2">
              {documents.length} documents • {selectedDocuments.length} selected
            </div>
          </div>

          {/* Document List */}
          <div className="flex-1 overflow-y-auto p-4">
            {isLoading ? (
              <DocumentListSkeleton />
            ) : filteredDocuments.length === 0 ? (
              <div className="text-center py-8">
                <File className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">
                  {searchTerm 
                    ? 'No documents match your search' 
                    : 'Upload documents to get started with AI-powered analysis'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredDocuments.map((document) => (
                  <div
                    key={document.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedDocuments.includes(document.id)
                        ? 'border-joa-primary bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => handleSelectDocument(document.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <File className="w-4 h-4 text-gray-500 flex-shrink-0" />
                          <span className="text-sm font-medium text-gray-900 truncate">
                            {document.displayName || document.name || document.filename || document.originalName || 'Unknown'}
                          </span>
                          <KnowledgeStatusBadge status={document.status} />
                        </div>

                        <div className="flex items-center space-x-4 mt-1 text-xs text-gray-500">
                          <span>{document.size ? `${(document.size / 1024).toFixed(1)} KB` : 'Unknown size'}</span>
                          <span>{document.type || 'Unknown type'}</span>
                          {(document.uploadedAt || document.uploadDate) && (
                            <>
                              <span>•</span>
                              <span>{new Date(document.uploadedAt || document.uploadDate || '').toLocaleDateString()}</span>
                            </>
                          )}
                          {(document.mimeType?.startsWith('video/') || document.mimeType?.startsWith('audio/')) && document.status === 'processed' && (
                            <>
                              <span>•</span>
                              <span className="font-medium text-violet-600">Transcript indexed</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewDocument(document);
                          }}
                          className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                          title="Preview"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {document.storageProvider === 'volume' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMigrateToStorage(document);
                            }}
                            className="p-1 text-gray-400 hover:text-amber-600 transition-colors"
                            title="Move to object storage"
                          >
                            <Upload className="w-4 h-4 text-amber-500" />
                          </button>
                        )}
                        {(document.mimeType?.startsWith('video/') || document.mimeType?.startsWith('audio/')) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenInMediaLab(document);
                            }}
                            className="p-1 text-gray-400 hover:text-violet-600 transition-colors"
                            title="Open in Media AI"
                          >
                            <Film className="w-4 h-4 text-violet-500" />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(document.id);
                          }}
                          className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - RAG Search */}
        <div className="w-1/2 flex flex-col">
          <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-indigo-600">
            <h3 className="text-lg font-semibold text-white mb-2">Semantic Search</h3>
            <p className="text-sm text-white/90">Search across your documents using AI</p>
          </div>

          <div className="p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Query
              </label>
              <textarea
                value={ragQuery}
                onChange={(e) => setRagQuery(e.target.value)}
                placeholder="Enter your search query..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-joa-primary focus:border-joa-primary min-h-[100px]"
              />
            </div>

            <button
              onClick={handleRAGSearch}
              disabled={!ragQuery.trim() || isSearching}
              className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-joa-primary text-white rounded-lg hover:bg-red-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Search className="w-4 h-4" />
              <span>{isSearching ? 'Searching...' : 'Search'}</span>
            </button>

            {selectedDocuments.length > 0 && (
              <div className="text-sm text-gray-600 bg-blue-50 p-2 rounded">
                Searching in {selectedDocuments.length} selected document(s)
              </div>
            )}
          </div>

          {/* Search Results */}
          {searchResults && searchResults.length > 0 ? (
            <div className="flex-1 overflow-y-auto p-4">
              <div className="mb-4">
                <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                  Query: "{ragQuery}"
                </div>
              </div>
              <div className="space-y-4">
                {searchResults.map((result, index) => (
                  <SourceChunkCard key={result.id} result={result} index={index} />
                ))}
              </div>
              
              {/* Citations Summary */}
              <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <h5 className="text-sm font-semibold text-blue-900">References & Citations</h5>
                </div>
                <div className="space-y-2">
                  {searchResults.map((result, index) => {
                    const metadata = result;
                    const citation = generateCitation(metadata, index);
                    return (
                      <div key={citation.id} className="flex items-center justify-between text-xs bg-white p-2 rounded border">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center text-xs font-bold">
                            {index + 1}
                          </span>
                          <span className="text-blue-800 font-medium">{citation.text}</span>
                          <span className="text-blue-600">•</span>
                          <span className="text-blue-600">Position {citation.position}</span>
                        </div>
                        <button 
                          className="text-blue-600 hover:text-blue-800 transition-colors"
                          onClick={() => {
                            navigator.clipboard?.writeText(citation.fullCitation);
                          }}
                        >
                          Copy Citation
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 text-xs text-blue-700">
                  <p className="font-medium">📚 Academic Citation Format:</p>
                  <p className="mt-1 italic">
                    "JoaLLM Knowledge Base Search Results. Retrieved from {new Date().toLocaleDateString()}. 
                    Query: '{ragQuery}'. {searchResults.length} results found."
                  </p>
                </div>
              </div>
            </div>
          ) : searchResults && searchResults.length === 0 ? (
            <div className="flex-1 overflow-y-auto p-4">
              <div className="text-center py-8">
                <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h4 className="text-lg font-medium text-gray-900 mb-2">No results found</h4>
                <p className="text-gray-600 mb-4">
                  Try adjusting your search query or check the following:
                </p>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Use different keywords</li>
                  <li>• Check spelling</li>
                  <li>• Try broader terms</li>
                  <li>• Check if documents are processed</li>
                </ul>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 p-4 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Info className="w-4 h-4 text-joa-primary" />
            <span>Supported formats: PDF, DOCX, TXT, CSV, MD, DOC, Images, Audio, Video</span>
          </div>
        </div>
      </div>

      {/* Document Preview Modal */}
      <DocumentPreviewModal
        document={previewDocument}
        isOpen={!!previewDocument}
        onClose={() => setPreviewDocument(null)}
      />

      {/* Analytics Dashboard Modal */}
      <RAGAnalyticsDashboard
        isOpen={showAnalytics}
        onClose={() => setShowAnalytics(false)}
      />

      {/* Advanced Search Modal */}
      <AdvancedSearchPanel
        isOpen={showAdvancedSearch}
        onClose={() => setShowAdvancedSearch(false)}
        onSearch={(query, filters) => {
        }}
      />

      {/* RAG Configuration Modal */}
      <RAGConfigurationPanel
        isOpen={showConfiguration}
        onClose={() => setShowConfiguration(false)}
        onConfigSave={(config) => {
        }}
      />

      {/* Bulk Delete Confirmation Modal */}
      <BulkDeleteConfirmModal
        isOpen={showBulkDeleteConfirm}
        documents={documents.filter(doc => selectedDocuments.includes(doc.id))}
        onConfirm={confirmBulkDelete}
        onCancel={() => setShowBulkDeleteConfirm(false)}
        onBackup={handleBulkDownload}
      />

      {/* Clear All & Upload New Modal */}
      <ClearAndUploadModal
        isOpen={showClearAndUpload}
        onClose={() => setShowClearAndUpload(false)}
        documentCount={documents.length}
        onClearAll={handleClearAll}
        onUploadFiles={uploadMultiple}
      />
    </div>
  );
}
