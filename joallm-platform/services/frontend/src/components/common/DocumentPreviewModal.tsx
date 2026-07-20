import React, { useState, useEffect } from 'react';
import { X, Download, FileText, Image as ImageIcon, File, Eye, Info, Hash, Calendar, FileType } from 'lucide-react';
import { apiClient } from '../../utils/api-client';
import { API_ENDPOINTS } from '../../config/api';
import { getFormatStatus } from '../../utils/fileValidation';
import { FileSupportBadge } from './FileSupportBadge';

interface Document {
  id: string;
  name: string;
  type: string;
  size: number;
  status: 'ready' | 'processing' | 'failed';
  createdAt: string;
  mimeType: string;
  filename?: string;
  originalName?: string;
  chunks?: number;
  metadata?: any;
}

interface DocumentPreviewModalProps {
  document: Document | null;
  isOpen: boolean;
  onClose: () => void;
}

export function DocumentPreviewModal({ document, isOpen, onClose }: DocumentPreviewModalProps) {
  const [content, setContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (document && isOpen) {
      loadDocumentContent();
    }
  }, [document, isOpen]);

  const loadDocumentContent = async () => {
    if (!document) return;

    setIsLoading(true);
    setError('');

    try {
      const response = await apiClient.get<string>(
        API_ENDPOINTS.files.download(document.id)
      );
      setContent(response);
    } catch (err) {
      setError('Failed to load document content');
      // Only log errors in development
      if (import.meta.env.DEV) {
        console.error('Document preview error:', err);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!document) return;

    try {
      const blob = await apiClient.get<Blob>(
        API_ENDPOINTS.files.download(document.id),
        { responseType: 'blob' }
      );

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = document.name || 'download';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      // Only log errors in development
      if (import.meta.env.DEV) {
        console.error('Download failed:', err);
      }
      setError('Download failed. Please try again.');
    }
  };

  const getFileIcon = () => {
    const mimeType = document?.mimeType || document?.type || '';
    if (mimeType.startsWith('image/')) return ImageIcon;
    if (mimeType === 'application/pdf' || mimeType.includes('pdf')) return FileText;
    return File;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (dateValue: any) => {
    if (!dateValue) return 'Unknown date';
    try {
      const date = typeof dateValue === 'string' ? new Date(dateValue) : dateValue;
      return date.toLocaleDateString();
    } catch {
      return 'Invalid date';
    }
  };

  if (!isOpen || !document) return null;

  const Icon = getFileIcon();
  const fileName = document.name || document.filename || document.originalName || 'Unknown Document';
  const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';
  const formatStatus = getFormatStatus(`.${fileExtension}`);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-4/5 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <Icon className="w-6 h-6 text-gray-400" />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-lg font-semibold text-gray-900">{fileName}</h2>
                <FileSupportBadge status={formatStatus} format={`.${fileExtension}`} size="sm" />
              </div>
              <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
                <span>{formatFileSize(document.size || 0)}</span>
                <span>•</span>
                <span>{formatDate(document.createdAt)}</span>
                <span>•</span>
                <span className={`px-2 py-1 rounded-full text-xs ${
                  document.status === 'ready' || document.status === 'processed' ? 'bg-green-100 text-green-800' :
                  document.status === 'processing' || document.status === 'uploaded' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {document.status}
                </span>
                {document.chunks && (
                  <>
                    <span>•</span>
                    <span title="Number of searchable chunks">{document.chunks} chunks</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className={`p-2 rounded-lg transition-colors ${
                showDetails ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:bg-gray-100'
              }`}
              title="Show file details"
            >
              <Info className="w-4 h-4" />
            </button>

            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              title="Download file"
            >
              <Download className="w-4 h-4" />
              <span className="text-sm">Download</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* File Details Panel (Expandable) */}
        {showDetails && (
          <div className="bg-blue-50 border-b border-blue-200 p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-600" />
              File Details
            </h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="flex items-start gap-2">
                <Hash className="w-3 h-3 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-gray-500 font-medium">File ID</p>
                  <p className="text-gray-900 font-mono break-all">{document.id}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <FileType className="w-3 h-3 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-gray-500 font-medium">MIME Type</p>
                  <p className="text-gray-900">{document.mimeType || 'Unknown'}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <FileText className="w-3 h-3 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-gray-500 font-medium">File Type</p>
                  <p className="text-gray-900">{document.type || `.${fileExtension}`}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Calendar className="w-3 h-3 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-gray-500 font-medium">Uploaded</p>
                  <p className="text-gray-900">{formatDate(document.createdAt)}</p>
                </div>
              </div>
              {document.chunks !== undefined && (
                <div className="flex items-start gap-2">
                  <Hash className="w-3 h-3 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-gray-500 font-medium">Searchable Chunks</p>
                    <p className="text-gray-900">{document.chunks} chunks indexed</p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-2">
                <Info className="w-3 h-3 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-gray-500 font-medium">Format Support</p>
                  <p className="text-gray-900 capitalize">{formatStatus}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-joa-primary mx-auto mb-4"></div>
                <p className="text-gray-600">Loading document...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <X className="w-12 h-12 text-red-400 mx-auto mb-4" />
                <p className="text-red-600 mb-2">{error}</p>
                <button
                  onClick={loadDocumentContent}
                  className="px-4 py-2 bg-joa-primary text-white rounded-lg hover:bg-red-800 transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : (
            <div className="h-full overflow-auto p-6">
              {(() => {
                const mimeType = document.mimeType || document.type || '';
                const isImage = mimeType.startsWith('image/') || fileName.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i);
                const isPDF = mimeType === 'application/pdf' || mimeType.includes('pdf') || fileName.endsWith('.pdf');
                
                if (isImage) {
                  return (
                    <div className="flex justify-center">
                      <img
                        src={content}
                        alt={fileName}
                        className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                        style={{ maxHeight: '70vh' }}
                      />
                    </div>
                  );
                } else if (isPDF) {
                  return (
                    <div className="text-center">
                      <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600 mb-4">PDF preview not available in browser</p>
                      <p className="text-sm text-gray-500">Download the file to view its contents</p>
                    </div>
                  );
                } else {
                  return (
                    <div className="bg-gray-50 rounded-lg p-4 h-full overflow-auto">
                      <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono leading-relaxed">
                        {typeof content === 'string' ? content : JSON.stringify(content, null, 2)}
                      </pre>
                    </div>
                  );
                }
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


