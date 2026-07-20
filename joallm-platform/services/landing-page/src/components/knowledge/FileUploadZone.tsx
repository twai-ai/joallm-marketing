import React, { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { Upload, File, Image, FileText, X, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { AttachmentStatus } from '../../types';
import { showError } from '../../utils/toast';

interface FileUploadItem {
  id: string;
  file: File;
  status: AttachmentStatus;
  progress: number;
  error?: string;
  preview?: string;
  estimatedTime?: number;
}

interface FileUploadZoneProps {
  onFilesSelected: (files: FileUploadItem[]) => void;
  onFileRemove?: (fileId: string) => void;
  maxFileSize?: number; // in MB
  acceptedTypes?: string[];
  multiple?: boolean;
  showPreviews?: boolean;
}

export function FileUploadZone({
  onFilesSelected,
  onFileRemove,
  maxFileSize = 50,
  acceptedTypes = [
    // Documents
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.odt', '.ods', '.odp',
    // Text files
    '.txt', '.md', '.markdown', '.csv', '.html', '.xml', '.rtf',
    // Images
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.svg',
    // Archives
    '.zip', '.rar', '.7z',
    // Data formats
    '.json', '.yaml', '.yml',
    // Code files
    '.js', '.ts', '.py', '.java', '.c', '.cpp', '.cs', '.php', '.rb', '.go', '.rs', '.sql',
    // Ebooks
    '.epub', '.mobi',
    // Other
    '.vcf', '.msg', '.eml'
  ],
  multiple = true,
  showPreviews = true,
}: FileUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<FileUploadItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <Image className="w-6 h-6" />;
    if (type.includes('pdf')) return <FileText className="w-6 h-6 text-red-500" />;
    return <File className="w-6 h-6" />;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const validateFile = (file: File): string | null => {
    // Check file size
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxFileSize) {
      return `File size exceeds ${maxFileSize}MB limit`;
    }

    // Check file type
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!acceptedTypes.some(type => type === fileExtension || type === '*')) {
      return `File type not supported. Accepted: ${acceptedTypes.join(', ')}`;
    }

    return null;
  };

  const createFilePreview = (file: File): Promise<string | undefined> => {
    return new Promise((resolve) => {
      if (!file.type.startsWith('image/')) {
        resolve(undefined);
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(undefined);
      reader.readAsDataURL(file);
    });
  };

  const processFiles = async (files: FileList | File[]) => {
    const filesArray = Array.from(files);
    const newUploadItems: FileUploadItem[] = [];

    for (const file of filesArray) {
      const error = validateFile(file);
      const preview = await createFilePreview(file);

      const uploadItem: FileUploadItem = {
        id: `file-${Date.now()}-${Math.random()}`,
        file,
        status: error ? AttachmentStatus.ERROR : AttachmentStatus.UPLOADING,
        progress: 0,
        error,
        preview,
      };

      newUploadItems.push(uploadItem);

      if (error) {
        showError(error, `Failed to upload ${file.name}`);
      }
    }

    setUploadingFiles(prev => [...prev, ...newUploadItems]);
    onFilesSelected(newUploadItems.filter(item => !item.error));

    // Simulate upload progress (in real implementation, this would track actual upload)
    newUploadItems.forEach((item, index) => {
      if (!item.error) {
        simulateUploadProgress(item.id, index * 200);
      }
    });
  };

  const simulateUploadProgress = (fileId: string, delay: number = 0) => {
    setTimeout(() => {
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 15;
        
        setUploadingFiles(prev =>
          prev.map(item =>
            item.id === fileId
              ? {
                  ...item,
                  progress: Math.min(progress, 100),
                  status: progress >= 100 ? AttachmentStatus.PROCESSING : AttachmentStatus.UPLOADING,
                  estimatedTime: progress < 100 ? Math.ceil((100 - progress) / 10) : undefined,
                }
              : item
          )
        );

        if (progress >= 100) {
          clearInterval(interval);
          // Move to processing state
          setTimeout(() => {
            setUploadingFiles(prev =>
              prev.map(item =>
                item.id === fileId
                  ? { ...item, status: AttachmentStatus.READY }
                  : item
              )
            );
          }, 1000);
        }
      }, 500);
    }, delay);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFiles(files);
    }
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFiles(files);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveFile = (fileId: string) => {
    setUploadingFiles(prev => prev.filter(item => item.id !== fileId));
    onFileRemove?.(fileId);
  };

  const handleRetry = (fileId: string) => {
    setUploadingFiles(prev =>
      prev.map(item =>
        item.id === fileId
          ? { ...item, status: AttachmentStatus.UPLOADING, progress: 0, error: undefined }
          : item
      )
    );
    simulateUploadProgress(fileId);
  };

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          transition-all duration-200
          ${isDragging
            ? 'border-joa-primary bg-joa-primary bg-opacity-5 scale-[1.02]'
            : 'border-gray-300 hover:border-joa-primary hover:bg-gray-50'
          }
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple={multiple}
          accept={acceptedTypes.join(',')}
          onChange={handleFileSelect}
          className="hidden"
        />

        <div className="flex flex-col items-center gap-3">
          <div className={`p-3 rounded-full ${isDragging ? 'bg-joa-primary text-white' : 'bg-gray-100 text-gray-600'}`}>
            <Upload className="w-8 h-8" />
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              {isDragging ? 'Drop files here' : 'Upload Documents'}
            </h3>
            <p className="text-sm text-gray-600 mb-2">
              Drag and drop files here, or click to browse
            </p>
            <p className="text-xs text-gray-500">
              Supported: {acceptedTypes.join(', ')} • Max {maxFileSize}MB per file
            </p>
          </div>
        </div>

        {/* Overlay for drag state */}
        {isDragging && (
          <div className="absolute inset-0 bg-joa-primary bg-opacity-10 rounded-lg pointer-events-none" />
        )}
      </div>

      {/* Uploading Files List */}
      {uploadingFiles.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">
            {multiple ? `Uploading ${uploadingFiles.length} file(s)` : 'Uploading file'}
          </h4>

          <div className="space-y-2">
            {uploadingFiles.map(item => (
              <div
                key={item.id}
                className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg"
              >
                {/* Preview or Icon */}
                {showPreviews && item.preview ? (
                  <img
                    src={item.preview}
                    alt={item.file.name}
                    className="w-12 h-12 object-cover rounded"
                  />
                ) : (
                  <div className="flex-shrink-0 p-2 bg-gray-100 rounded">
                    {getFileIcon(item.file.type)}
                  </div>
                )}

                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {item.file.name}
                    </p>
                    {item.status === AttachmentStatus.READY && (
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    )}
                  </div>

                  <p className="text-xs text-gray-500 mb-1">
                    {formatFileSize(item.file.size)}
                    {item.estimatedTime && ` • ${item.estimatedTime}s remaining`}
                  </p>

                  {/* Progress Bar */}
                  {item.status === AttachmentStatus.UPLOADING && (
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div
                        className="bg-joa-primary h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  )}

                  {/* Status Messages */}
                  {item.status === AttachmentStatus.PROCESSING && (
                    <div className="flex items-center gap-1 text-xs text-blue-600">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Processing...</span>
                    </div>
                  )}

                  {item.status === AttachmentStatus.ERROR && item.error && (
                    <div className="flex items-center gap-1 text-xs text-red-600">
                      <AlertCircle className="w-3 h-3" />
                      <span>{item.error}</span>
                    </div>
                  )}

                  {item.status === AttachmentStatus.READY && (
                    <div className="text-xs text-green-600 font-medium">
                      Ready
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex-shrink-0 flex items-center gap-1">
                  {item.status === AttachmentStatus.ERROR && (
                    <button
                      onClick={() => handleRetry(item.id)}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      title="Retry upload"
                    >
                      <Upload className="w-4 h-4" />
                    </button>
                  )}
                  
                  <button
                    onClick={() => handleRemoveFile(item.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Remove file"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

