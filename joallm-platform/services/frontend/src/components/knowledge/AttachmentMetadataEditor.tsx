import React, { useState, useEffect } from 'react';
import { X, Save, Tag, Folder, FileText, Sliders, CheckSquare, Square } from 'lucide-react';
import { Document, AttachmentMetadata, AttachmentPriority } from '../../types';
import { showSuccess, showError } from '../../utils/toast';

interface AttachmentMetadataEditorProps {
  document: Document | null;
  documents?: Document[]; // For bulk edit
  isOpen: boolean;
  onClose: () => void;
  onSave: (documentId: string, metadata: AttachmentMetadata) => Promise<void>;
  onBulkSave?: (documentIds: string[], metadata: Partial<AttachmentMetadata>) => Promise<void>;
}

const CATEGORIES = [
  'Documentation',
  'Research',
  'Code',
  'Personal',
  'Business',
  'Reference',
  'Tutorial',
  'API',
  'Other',
];

const TAG_SUGGESTIONS = [
  'important',
  'reference',
  'draft',
  'review',
  'archived',
  'python',
  'javascript',
  'api',
  'database',
  'frontend',
  'backend',
];

export function AttachmentMetadataEditor({
  document,
  documents = [],
  isOpen,
  onClose,
  onSave,
  onBulkSave,
}: AttachmentMetadataEditorProps) {
  const isBulkEdit = documents.length > 1;
  const targetDoc = document || documents[0];

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [category, setCategory] = useState('');
  const [relevanceBoost, setRelevanceBoost] = useState(0);
  const [priority, setPriority] = useState<AttachmentPriority>(AttachmentPriority.NORMAL);
  const [activeSections, setActiveSections] = useState<number[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Initialize form with document data
  useEffect(() => {
    if (targetDoc && isOpen) {
      setTitle(targetDoc.metadata?.title || targetDoc.name);
      setDescription(targetDoc.metadata?.description || '');
      setTags(targetDoc.metadata?.tags || []);
      setCategory(targetDoc.metadata?.category || '');
      setRelevanceBoost(targetDoc.metadata?.relevanceBoost || 0);
      setPriority(targetDoc.metadata?.priority || AttachmentPriority.NORMAL);
      setActiveSections(targetDoc.metadata?.activeSections || []);
    }
  }, [targetDoc, isOpen]);

  const handleAddTag = (tag: string) => {
    const trimmedTag = tag.trim().toLowerCase();
    if (trimmedTag && !tags.includes(trimmedTag)) {
      setTags([...tags, trimmedTag]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag(tagInput);
    }
  };

  const toggleSection = (chunkIndex: number) => {
    if (activeSections.includes(chunkIndex)) {
      setActiveSections(activeSections.filter(i => i !== chunkIndex));
    } else {
      setActiveSections([...activeSections, chunkIndex]);
    }
  };

  const selectAllSections = () => {
    if (!targetDoc?.chunks) return;
    setActiveSections(Array.from({ length: targetDoc.chunks }, (_, i) => i));
  };

  const deselectAllSections = () => {
    setActiveSections([]);
  };

  const handleSave = async () => {
    if (!targetDoc) return;

    setIsSaving(true);
    try {
      const metadata: AttachmentMetadata = {
        title: title.trim(),
        description: description.trim(),
        tags,
        category: category || undefined,
        relevanceBoost,
        priority,
        activeSections: activeSections.length > 0 ? activeSections : undefined,
      };

      if (isBulkEdit && onBulkSave) {
        // Bulk save - only save non-empty fields
        const bulkMetadata: Partial<AttachmentMetadata> = {};
        if (tags.length > 0) bulkMetadata.tags = tags;
        if (category) bulkMetadata.category = category;
        if (relevanceBoost !== 0) bulkMetadata.relevanceBoost = relevanceBoost;
        if (priority !== AttachmentPriority.NORMAL) bulkMetadata.priority = priority;

        await onBulkSave(
          documents.map(d => d.id),
          bulkMetadata
        );
        showSuccess(`Updated ${documents.length} documents`);
      } else {
        await onSave(targetDoc.id, metadata);
        showSuccess('Metadata updated successfully');
      }

      onClose();
    } catch (error) {
      console.error('Failed to save metadata:', error);
      showError('Failed to save metadata');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !targetDoc) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {isBulkEdit ? `Edit ${documents.length} Documents` : 'Edit Document Metadata'}
            </h2>
            {!isBulkEdit && (
              <p className="text-sm text-gray-600 mt-0.5 truncate">
                {targetDoc.name}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Title */}
          {!isBulkEdit && (
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <FileText className="w-4 h-4" />
                Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-joa-primary focus:border-transparent"
                placeholder="Document title..."
              />
              <p className="text-xs text-gray-500 mt-1">
                A descriptive title helps with search and organization
              </p>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <FileText className="w-4 h-4" />
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-joa-primary focus:border-transparent resize-none"
              placeholder="Add a description to improve RAG relevance..."
            />
            <p className="text-xs text-gray-500 mt-1">
              Description helps the AI understand the document's context
            </p>
          </div>

          {/* Tags */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Tag className="w-4 h-4" />
              Tags
            </label>
            
            {/* Tag Input */}
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-joa-primary focus:border-transparent"
                placeholder="Add tags (press Enter)..."
              />
              <button
                onClick={() => handleAddTag(tagInput)}
                className="px-4 py-2 bg-joa-primary text-white rounded-lg hover:bg-joa-primary-dark transition-colors"
              >
                Add
              </button>
            </div>

            {/* Current Tags */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {tags.map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded-md text-sm"
                  >
                    {tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:text-purple-900"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Tag Suggestions */}
            <div className="flex flex-wrap gap-1">
              {TAG_SUGGESTIONS.filter(t => !tags.includes(t)).slice(0, 6).map(tag => (
                <button
                  key={tag}
                  onClick={() => handleAddTag(tag)}
                  className="px-2 py-1 text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                >
                  + {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Folder className="w-4 h-4" />
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-joa-primary focus:border-transparent"
            >
              <option value="">Select a category...</option>
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Priority */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              Priority in RAG Context
            </label>
            <div className="flex gap-2">
              {[AttachmentPriority.LOW, AttachmentPriority.NORMAL, AttachmentPriority.HIGH].map(p => (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  className={`flex-1 px-4 py-2 rounded-lg border-2 transition-colors ${
                    priority === p
                      ? 'border-joa-primary bg-joa-primary text-white'
                      : 'border-gray-300 text-gray-700 hover:border-gray-400'
                  }`}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Relevance Boost */}
          <div>
            <label className="flex items-center justify-between text-sm font-medium text-gray-700 mb-2">
              <span className="flex items-center gap-2">
                <Sliders className="w-4 h-4" />
                Relevance Boost
              </span>
              <span className="text-joa-primary font-semibold">
                {relevanceBoost > 0 ? '+' : ''}{relevanceBoost}
              </span>
            </label>
            <input
              type="range"
              min="-2"
              max="2"
              step="0.5"
              value={relevanceBoost}
              onChange={(e) => setRelevanceBoost(parseFloat(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Lower priority</span>
              <span>Default</span>
              <span>Higher priority</span>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Adjust how strongly this document influences RAG responses
            </p>
          </div>

          {/* Active Sections (Chunk Selection) */}
          {!isBulkEdit && targetDoc.chunks && targetDoc.chunks > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  Active Sections
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={selectAllSections}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    Select All
                  </button>
                  <button
                    onClick={deselectAllSections}
                    className="text-xs text-gray-600 hover:text-gray-800"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg p-3 max-h-48 overflow-y-auto">
                <div className="grid grid-cols-5 gap-2">
                  {Array.from({ length: Math.min(targetDoc.chunks, 50) }, (_, i) => (
                    <button
                      key={i}
                      onClick={() => toggleSection(i)}
                      className={`flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs transition-colors ${
                        activeSections.length === 0 || activeSections.includes(i)
                          ? 'bg-purple-100 text-purple-700 border-2 border-purple-300'
                          : 'bg-gray-100 text-gray-400 border-2 border-gray-200'
                      }`}
                    >
                      {activeSections.length === 0 || activeSections.includes(i) ? (
                        <CheckSquare className="w-3 h-3" />
                      ) : (
                        <Square className="w-3 h-3" />
                      )}
                      {i + 1}
                    </button>
                  ))}
                </div>
                {targetDoc.chunks > 50 && (
                  <p className="text-xs text-gray-500 mt-2">
                    Showing first 50 of {targetDoc.chunks} chunks
                  </p>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {activeSections.length === 0
                  ? 'All sections included by default'
                  : `${activeSections.length} section(s) selected`}
              </p>
            </div>
          )}

          {/* Live Preview */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Preview</h4>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-gray-600">Title:</span>{' '}
                <span className="font-medium">{title || 'Untitled'}</span>
              </div>
              {description && (
                <div>
                  <span className="text-gray-600">Description:</span>{' '}
                  <span className="text-gray-900">{description}</span>
                </div>
              )}
              {tags.length > 0 && (
                <div>
                  <span className="text-gray-600">Tags:</span>{' '}
                  <span className="text-gray-900">{tags.join(', ')}</span>
                </div>
              )}
              {category && (
                <div>
                  <span className="text-gray-600">Category:</span>{' '}
                  <span className="text-gray-900">{category}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 bg-joa-primary text-white rounded-lg hover:bg-joa-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

