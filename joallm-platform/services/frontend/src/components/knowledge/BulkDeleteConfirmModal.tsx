import React, { useState } from 'react';
import { AlertTriangle, X, Trash2, FileText, CheckCircle, Loader2, Download } from 'lucide-react';
import type { Document } from '../../types';

interface BulkDeleteConfirmModalProps {
  isOpen: boolean;
  documents: Document[];
  onConfirm: () => Promise<void>;
  onCancel: () => void;
  onBackup?: () => Promise<void>;
}

export function BulkDeleteConfirmModal({
  isOpen,
  documents,
  onConfirm,
  onCancel,
  onBackup
}: BulkDeleteConfirmModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [showFullList, setShowFullList] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      await onConfirm();
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBackup = async () => {
    if (!onBackup) return;
    setIsBackingUp(true);
    try {
      await onBackup();
    } finally {
      setIsBackingUp(false);
    }
  };

  const totalSize = documents.reduce((sum, doc) => sum + (doc.size || 0), 0);
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const displayDocs = showFullList ? documents : documents.slice(0, 5);
  const hasMore = documents.length > 5;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-red-50">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Confirm Bulk Delete</h3>
              <p className="text-sm text-gray-600 mt-1">
                You're about to delete {documents.length} document{documents.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            disabled={isDeleting || isBackingUp}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Warning */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-900 mb-1">
                  This action cannot be undone!
                </p>
                <p className="text-sm text-red-700">
                  All selected documents and their indexed data will be permanently removed from the knowledge base.
                </p>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-gray-900">{documents.length}</div>
              <div className="text-xs text-gray-600 mt-1">Documents</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-gray-900">{formatSize(totalSize)}</div>
              <div className="text-xs text-gray-600 mt-1">Total Size</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-gray-900">
                {documents.filter(d => d.status === 'processed').length}
              </div>
              <div className="text-xs text-gray-600 mt-1">Processed</div>
            </div>
          </div>

          {/* Document List */}
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
              <FileText className="w-4 h-4 mr-2" />
              Documents to be deleted:
            </h4>
            <div className="space-y-2 max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-3 bg-gray-50">
              {displayDocs.map((doc, index) => {
                const docName = doc.name || doc.filename || doc.originalName || 'Unknown';
                return (
                  <div key={doc.id} className="flex items-center justify-between py-2 px-3 bg-white rounded border border-gray-200">
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <span className="text-xs text-gray-500 font-mono">{index + 1}.</span>
                      <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {docName}
                        </div>
                        {doc.size && (
                          <div className="text-xs text-gray-500">
                            {formatSize(doc.size)}
                          </div>
                        )}
                      </div>
                    </div>
                    {doc.status && (
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        doc.status === 'processed' ? 'bg-green-100 text-green-700' :
                        doc.status === 'failed' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {doc.status}
                      </span>
                    )}
                  </div>
                );
              })}
              
              {hasMore && !showFullList && (
                <button
                  onClick={() => setShowFullList(true)}
                  className="w-full py-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Show {documents.length - 5} more...
                </button>
              )}
              
              {showFullList && hasMore && (
                <button
                  onClick={() => setShowFullList(false)}
                  className="w-full py-2 text-sm text-gray-600 hover:text-gray-700 font-medium"
                >
                  Show less
                </button>
              )}
            </div>
          </div>

          {/* Backup Option */}
          {onBackup && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <Download className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-blue-900 mb-2">
                    Download a backup first?
                  </p>
                  <p className="text-sm text-blue-700 mb-3">
                    Export document list and metadata before deleting.
                  </p>
                  <button
                    onClick={handleBackup}
                    disabled={isBackingUp || isDeleting}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                  >
                    {isBackingUp ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Downloading...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        <span>Download Backup</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onCancel}
            disabled={isDeleting || isBackingUp}
            className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isDeleting || isBackingUp}
            className="flex items-center space-x-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span>Yes, Delete {documents.length} Document{documents.length !== 1 ? 's' : ''}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

