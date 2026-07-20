import React, { useState } from 'react';
import { X, Star, Eye, Edit, GripVertical, ChevronDown, ChevronUp, Plus, Loader2, File, FileText, Image as ImageIcon } from 'lucide-react';
import { Document, AttachmentPriority, AttachmentStatus } from '../../types';

interface AttachmentPanelProps {
  attachments: Document[];
  onRemove: (documentId: string) => void;
  onPriorityChange: (documentId: string, priority: AttachmentPriority) => void;
  onPreview: (document: Document) => void;
  onEditMetadata: (document: Document) => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
  onAddMore: () => void;
  isCollapsed?: boolean;
}

export function AttachmentPanel({
  attachments,
  onRemove,
  onPriorityChange,
  onPreview,
  onEditMetadata,
  onReorder,
  onAddMore,
  isCollapsed: initialCollapsed = false,
}: AttachmentPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  if (attachments.length === 0) return null;

  const getStatusIcon = (status: AttachmentStatus) => {
    switch (status) {
      case AttachmentStatus.UPLOADING:
        return <Loader2 className="w-3 h-3 animate-spin text-blue-500" />;
      case AttachmentStatus.PROCESSING:
        return <Loader2 className="w-3 h-3 animate-spin text-purple-500" />;
      case AttachmentStatus.EMBEDDING:
        return <Loader2 className="w-3 h-3 animate-spin text-indigo-500" />;
      case AttachmentStatus.READY:
        return <div className="w-2 h-2 bg-green-500 rounded-full" />;
      case AttachmentStatus.ERROR:
        return <div className="w-2 h-2 bg-red-500 rounded-full" />;
      default:
        return null;
    }
  };

  const getStatusText = (status: AttachmentStatus): string => {
    switch (status) {
      case AttachmentStatus.UPLOADING:
        return 'Uploading...';
      case AttachmentStatus.PROCESSING:
        return 'Processing...';
      case AttachmentStatus.EMBEDDING:
        return 'Embedding...';
      case AttachmentStatus.READY:
        return 'Ready';
      case AttachmentStatus.ERROR:
        return 'Error';
      default:
        return 'Unknown';
    }
  };

  const getFileIcon = (type: string) => {
    if (type.includes('image')) return <ImageIcon className="w-4 h-4" />;
    if (type.includes('pdf')) return <FileText className="w-4 h-4 text-red-500" />;
    return <File className="w-4 h-4" />;
  };

  const getPriorityColor = (priority?: AttachmentPriority) => {
    switch (priority) {
      case AttachmentPriority.HIGH:
        return 'text-red-500';
      case AttachmentPriority.LOW:
        return 'text-gray-400';
      default:
        return 'text-yellow-500';
    }
  };

  const cyclePriority = (currentPriority?: AttachmentPriority): AttachmentPriority => {
    switch (currentPriority) {
      case AttachmentPriority.HIGH:
        return AttachmentPriority.NORMAL;
      case AttachmentPriority.NORMAL:
        return AttachmentPriority.LOW;
      default:
        return AttachmentPriority.HIGH;
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== dropIndex && onReorder) {
      onReorder(draggedIndex, dropIndex);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div className="mb-3 bg-purple-50 border border-purple-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-purple-100 border-b border-purple-200">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 hover:bg-purple-200 rounded transition-colors"
            title={isCollapsed ? 'Expand' : 'Collapse'}
          >
            {isCollapsed ? (
              <ChevronDown className="w-4 h-4 text-purple-700" />
            ) : (
              <ChevronUp className="w-4 h-4 text-purple-700" />
            )}
          </button>

          <span className="text-sm font-medium text-purple-900">
            {attachments.length} Document{attachments.length !== 1 ? 's' : ''} Attached
          </span>

          {/* Status Summary */}
          <span className="text-xs text-purple-700">
            {attachments.filter(a => a.status === AttachmentStatus.READY).length} ready
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onAddMore}
            className="flex items-center gap-1 px-2 py-1 text-xs text-purple-700 hover:bg-purple-200 rounded transition-colors"
            title="Add more documents"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>
        </div>
      </div>

      {/* Attachment Cards */}
      {!isCollapsed && (
        <div className="p-2 space-y-1.5">
          {attachments.map((doc, index) => (
            <div
              key={doc.id}
              draggable={!!onReorder}
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={() => {
                setDraggedIndex(null);
                setDragOverIndex(null);
              }}
              className={`
                flex items-center gap-2 p-2 bg-white border rounded-md
                transition-all duration-150
                ${draggedIndex === index ? 'opacity-50 scale-95' : ''}
                ${dragOverIndex === index ? 'border-purple-400 bg-purple-50' : 'border-gray-200'}
                ${onReorder ? 'cursor-move' : ''}
                hover:border-purple-300
              `}
            >
              {/* Drag Handle */}
              {onReorder && (
                <div className="flex-shrink-0 text-gray-400 cursor-move">
                  <GripVertical className="w-4 h-4" />
                </div>
              )}

              {/* File Icon */}
              <div className="flex-shrink-0 p-1.5 bg-gray-100 rounded">
                {getFileIcon(doc.type)}
              </div>

              {/* Document Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {doc.metadata?.title || doc.name}
                  </p>
                  
                  {/* Status Indicator */}
                  <div className="flex-shrink-0 flex items-center gap-1">
                    {getStatusIcon(doc.status)}
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>{formatFileSize(doc.size)}</span>
                  {doc.chunks !== undefined && (
                    <span>• {doc.chunks} chunks</span>
                  )}
                  {doc.status !== AttachmentStatus.READY && (
                    <span>• {getStatusText(doc.status)}</span>
                  )}
                  {doc.progress && doc.progress.percentage < 100 && (
                    <span>• {doc.progress.percentage.toFixed(0)}%</span>
                  )}
                </div>

                {/* Progress Bar (if uploading/processing) */}
                {doc.progress && doc.progress.percentage < 100 && (
                  <div className="mt-1 w-full bg-gray-200 rounded-full h-1">
                    <div
                      className="bg-purple-500 h-1 rounded-full transition-all duration-300"
                      style={{ width: `${doc.progress.percentage}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              <div className="flex-shrink-0 flex items-center gap-0.5">
                {/* Priority Toggle */}
                <button
                  onClick={() => onPriorityChange(doc.id, cyclePriority(doc.metadata?.priority))}
                  className={`p-1.5 hover:bg-gray-100 rounded transition-colors ${getPriorityColor(doc.metadata?.priority)}`}
                  title={`Priority: ${doc.metadata?.priority || 'normal'}`}
                >
                  <Star className="w-3.5 h-3.5" fill="currentColor" />
                </button>

                {/* Preview */}
                <button
                  onClick={() => onPreview(doc)}
                  disabled={doc.status !== AttachmentStatus.READY}
                  className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Preview document"
                >
                  <Eye className="w-3.5 h-3.5" />
                </button>

                {/* Edit Metadata */}
                <button
                  onClick={() => onEditMetadata(doc)}
                  className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                  title="Edit metadata"
                >
                  <Edit className="w-3.5 h-3.5" />
                </button>

                {/* Remove */}
                <button
                  onClick={() => onRemove(doc.id)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  title="Remove attachment"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

