import React, { useState } from 'react';
import { Database, X, Check } from 'lucide-react';
import { useDocuments } from '../../hooks/useDocuments';

interface RAGContextSelectorProps {
  selectedDocuments: string[];
  onSelectDocuments: (documentIds: string[]) => void;
  onClose: () => void;
}

export function RAGContextSelector({
  selectedDocuments,
  onSelectDocuments,
  onClose,
}: RAGContextSelectorProps) {
  const { documents, isLoading } = useDocuments();
  const [localSelection, setLocalSelection] = useState<string[]>(selectedDocuments);

  const readyDocuments = documents.filter((doc) => doc.status === 'ready');

  const handleToggle = (documentId: string) => {
    setLocalSelection((prev) =>
      prev.includes(documentId)
        ? prev.filter((id) => id !== documentId)
        : [...prev, documentId]
    );
  };

  const handleApply = () => {
    onSelectDocuments(localSelection);
    onClose();
  };

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-joa-primary" />
          <h3 className="font-medium text-gray-900">Knowledge Base Context</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
        >
          <X className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {/* Document List */}
      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="text-center py-4 text-sm text-gray-500">Loading documents...</div>
        ) : readyDocuments.length === 0 ? (
          <div className="text-center py-4 text-sm text-gray-500">
            No documents available. Upload documents in Knowledge Base first.
          </div>
        ) : (
          <div className="space-y-1">
            {readyDocuments.map((doc) => (
              <button
                key={doc.id}
                onClick={() => handleToggle(doc.id)}
                className={`w-full flex items-center justify-between p-2 rounded-lg transition-colors ${
                  localSelection.includes(doc.id)
                    ? 'bg-red-50 hover:bg-red-100'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div
                    className={`w-4 h-4 rounded border flex items-center justify-center ${
                      localSelection.includes(doc.id)
                        ? 'bg-joa-primary border-joa-primary'
                        : 'border-gray-300'
                    }`}
                  >
                    {localSelection.includes(doc.id) && (
                      <Check className="w-3 h-3 text-white" />
                    )}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{doc.name}</p>
                    <p className="text-xs text-gray-500">
                      {doc.chunks ? `${doc.chunks} chunks` : 'Processing...'}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between p-3 border-t border-gray-200 bg-gray-50">
        <span className="text-sm text-gray-600">
          {localSelection.length} selected
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => setLocalSelection([])}
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 rounded-md hover:bg-gray-100 transition-colors"
          >
            Clear
          </button>
          <button
            onClick={handleApply}
            className="px-3 py-1.5 text-sm bg-joa-primary hover:bg-red-800 text-white rounded-md transition-colors"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

