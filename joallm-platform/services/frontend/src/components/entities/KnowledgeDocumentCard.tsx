import React from 'react';
import { FileText } from 'lucide-react';
import { KnowledgeDocument } from '../../domain/knowledge';
import { KnowledgeStatusBadge } from './KnowledgeStatusBadge';

interface KnowledgeDocumentCardProps {
  document: KnowledgeDocument;
  selected?: boolean;
  selectable?: boolean;
  onToggleSelected?: (documentId: string) => void;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}

export function KnowledgeDocumentCard({
  document,
  selected = false,
  selectable = true,
  onToggleSelected,
  actions,
  children,
}: KnowledgeDocumentCardProps) {
  const hasBucketPath =
    !!document.storageKey &&
    document.storageProvider !== undefined &&
    document.storageProvider !== 'volume';

  return (
    <label
      className={`flex flex-col gap-3 rounded-2xl border p-4 transition sm:flex-row sm:items-start ${
        selected ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'
      } ${!document.isReady && selectable ? 'opacity-85' : ''} ${selectable ? 'cursor-pointer' : ''}`}
    >
      <div className="flex items-start gap-3">
        {selectable && (
          <input
            type="checkbox"
            checked={selected}
            disabled={!document.isReady}
            onChange={() => onToggleSelected?.(document.id)}
            className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300 text-joa-primary focus:ring-joa-primary"
          />
        )}
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-600">
          <FileText className="h-5 w-5" />
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium text-gray-900">{document.displayName}</p>
          <KnowledgeStatusBadge status={document.status} />
        </div>
        <p className="mt-1 text-sm text-gray-600">
          {(document.size / 1024).toFixed(1)} KB
          {document.chunks ? ` • ${document.chunks} chunks indexed` : ''}
        </p>
        {hasBucketPath && (
          <p className="mt-1 text-xs text-gray-500">
            Bucket path: <span className="font-mono text-gray-700">{document.storageKey}</span>
          </p>
        )}
        {document.processingError && (
          <p className="mt-1 text-xs text-red-600">{document.processingError}</p>
        )}
        {children}
      </div>
      {actions ? <div className="w-full sm:w-auto">{actions}</div> : null}
    </label>
  );
}
