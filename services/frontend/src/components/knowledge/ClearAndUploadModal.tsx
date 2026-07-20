import React, { useState, useRef } from 'react';
import { Trash2, Upload, AlertTriangle, X, CheckCircle, Loader2, RefreshCw } from 'lucide-react';

interface ClearAndUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentCount: number;
  onClearAll: () => Promise<void>;
  onUploadFiles: (files: File[]) => Promise<void>;
}

export function ClearAndUploadModal({
  isOpen,
  onClose,
  documentCount,
  onClearAll,
  onUploadFiles
}: ClearAndUploadModalProps) {
  const [step, setStep] = useState<'confirm' | 'clearing' | 'upload' | 'uploading' | 'complete'>('confirm');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles(files);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const files = Array.from(e.dataTransfer.files);
    setSelectedFiles(files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleExecute = async () => {
    try {
      setError(null);
      
      // Step 1: Clear all documents
      setStep('clearing');
      await onClearAll();
      
      // Step 2: Upload new files if any selected
      if (selectedFiles.length > 0) {
        setStep('uploading');
        await onUploadFiles(selectedFiles);
      }
      
      // Step 3: Complete
      setStep('complete');
      
      // Auto-close after 2 seconds
      setTimeout(() => {
        onClose();
        resetModal();
      }, 2000);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operation failed');
      setStep('confirm');
    }
  };

  const resetModal = () => {
    setStep('confirm');
    setSelectedFiles([]);
    setError(null);
  };

  const handleClose = () => {
    if (step !== 'clearing' && step !== 'uploading') {
      onClose();
      resetModal();
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const totalSize = selectedFiles.reduce((sum, file) => sum + file.size, 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full">
        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b border-gray-200 ${
          step === 'complete' ? 'bg-green-50' : 'bg-gradient-to-r from-orange-50 to-red-50'
        }`}>
          <div className="flex items-center space-x-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              step === 'complete' ? 'bg-green-100' : 'bg-orange-100'
            }`}>
              {step === 'complete' ? (
                <CheckCircle className="w-6 h-6 text-green-600" />
              ) : (
                <RefreshCw className="w-6 h-6 text-orange-600" />
              )}
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">
                {step === 'complete' ? 'Complete!' : 'Clear All & Upload New'}
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {step === 'confirm' && 'Replace all documents in your knowledge base'}
                {step === 'clearing' && 'Deleting existing documents...'}
                {step === 'upload' && 'Ready to upload new files'}
                {step === 'uploading' && 'Uploading new files...'}
                {step === 'complete' && 'Knowledge base updated successfully'}
              </p>
            </div>
          </div>
          {step !== 'clearing' && step !== 'uploading' && (
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Confirm Step */}
          {step === 'confirm' && (
            <>
              {/* Warning */}
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-red-900 mb-1">
                      This will delete all {documentCount} existing documents!
                    </p>
                    <p className="text-sm text-red-700">
                      All documents and their indexed data will be permanently removed before uploading new files.
                    </p>
                  </div>
                </div>
              </div>

              {/* File Upload Area */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Select new files to upload (optional)
                </label>
                
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors"
                >
                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-sm text-gray-700 font-medium mb-1">
                    Drop files here or click to browse
                  </p>
                  <p className="text-xs text-gray-500">
                    PDF, Word, Excel, PowerPoint, Markdown, Text, CSV, JSON, Images
                  </p>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.csv,.json,.yaml,.yml,.html,.xml,.rtf,.jpg,.jpeg,.png,.gif,.webp"
                />
              </div>

              {/* Selected Files */}
              {selectedFiles.length > 0 && (
                <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <Upload className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-semibold text-blue-900">
                        {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected
                      </span>
                    </div>
                    <span className="text-sm text-blue-700">
                      Total: {formatFileSize(totalSize)}
                    </span>
                  </div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {selectedFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between text-sm bg-white rounded px-3 py-2">
                        <span className="text-gray-700 truncate">{file.name}</span>
                        <span className="text-gray-500 text-xs ml-2">{formatFileSize(file.size)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {/* Summary */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <div className="text-sm text-gray-700 space-y-2">
                  <div className="flex items-center justify-between">
                    <span>Documents to delete:</span>
                    <span className="font-semibold text-red-600">{documentCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>New files to upload:</span>
                    <span className="font-semibold text-green-600">{selectedFiles.length}</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Processing Steps */}
          {(step === 'clearing' || step === 'uploading') && (
            <div className="py-8">
              <div className="flex flex-col items-center">
                <Loader2 className="w-16 h-16 text-blue-600 animate-spin mb-4" />
                <p className="text-lg font-semibold text-gray-900 mb-2">
                  {step === 'clearing' ? 'Clearing existing documents...' : 'Uploading new files...'}
                </p>
                <p className="text-sm text-gray-600">
                  {step === 'clearing' && `Deleting ${documentCount} documents`}
                  {step === 'uploading' && `Uploading ${selectedFiles.length} files`}
                </p>
              </div>
            </div>
          )}

          {/* Complete Step */}
          {step === 'complete' && (
            <div className="py-8">
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle className="w-10 h-10 text-green-600" />
                </div>
                <p className="text-lg font-semibold text-gray-900 mb-2">
                  Knowledge base updated successfully!
                </p>
                <p className="text-sm text-gray-600">
                  {selectedFiles.length > 0 
                    ? `${selectedFiles.length} new files are being processed`
                    : 'All documents have been cleared'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 'confirm' && (
          <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
            <button
              onClick={handleClose}
              className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleExecute}
              className="flex items-center space-x-2 px-6 py-2.5 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white rounded-lg transition-colors font-medium"
            >
              <RefreshCw className="w-4 h-4" />
              <span>
                {selectedFiles.length > 0 
                  ? `Clear ${documentCount} & Upload ${selectedFiles.length}`
                  : `Clear All ${documentCount} Documents`}
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

