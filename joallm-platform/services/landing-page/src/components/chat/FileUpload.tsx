import React, { useRef, useState } from 'react';
import { Upload, X, FileText, Image as ImageIcon, File } from 'lucide-react';
import { apiClient } from '../../utils/api-client';
import { API_ENDPOINTS } from '../../config/api';
import { showError, showSuccess } from '../../utils/toast';
import { Attachment } from '../../types';

interface FileUploadProps {
  onFileUploaded: (attachment: Attachment) => void;
  onRemove?: (attachmentId: string) => void;
  attachments?: Attachment[];
  maxFiles?: number;
}

export function FileUpload({ 
  onFileUploaded, 
  onRemove, 
  attachments = [],
  maxFiles = 5 
}: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    if (attachments.length + files.length > maxFiles) {
      showError(`You can only upload up to ${maxFiles} files`);
      return;
    }

    setUploading(true);

    try {
      for (const file of Array.from(files)) {
        // Validate file size (10MB max)
        if (file.size > 10 * 1024 * 1024) {
          showError(`File ${file.name} is too large (max 10MB)`);
          continue;
        }

        // Upload file
        const response = await apiClient.uploadFile<{ fileId: string; id?: string; url?: string }>(
          API_ENDPOINTS.files.upload,
          file
        );

        const attachment: Attachment = {
          id: response.fileId || response.id,
          type: file.type.startsWith('image/') ? 'image' : 'file',
          name: file.name,
          url: response.url || `/api/files/${response.fileId || response.id}/download`,
          size: file.size,
          mimeType: file.type,
        };

        onFileUploaded(attachment);
        showSuccess(`${file.name} uploaded successfully`);
      }
    } catch (error) {
      showError('Failed to upload file');
      console.error('File upload error:', error);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const getFileIcon = (type: string) => {
    if (type === 'image') return ImageIcon;
    if (type === 'document') return FileText;
    return File;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="space-y-2">
      {/* Upload Button */}
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading || attachments.length >= maxFiles}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Upload className="w-4 h-4" />
        <span>{uploading ? 'Uploading...' : 'Attach files'}</span>
      </button>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileSelect}
        className="hidden"
        accept=".pdf,.doc,.docx,.txt,.csv,.png,.jpg,.jpeg,.gif,.webp"
      />

      {/* Attachment List */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((attachment) => {
            const Icon = getFileIcon(attachment.type);
            return (
              <div
                key={attachment.id}
                className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg group"
              >
                <Icon className="w-4 h-4 text-gray-600" />
                <div className="flex flex-col min-w-0">
                  <span className="text-sm text-gray-900 truncate max-w-[150px]">
                    {attachment.name}
                  </span>
                  {attachment.size && (
                    <span className="text-xs text-gray-500">
                      {formatFileSize(attachment.size)}
                    </span>
                  )}
                </div>
                {onRemove && (
                  <button
                    onClick={() => onRemove(attachment.id)}
                    className="ml-2 p-0.5 hover:bg-gray-200 rounded transition-colors"
                  >
                    <X className="w-3.5 h-3.5 text-gray-500" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


