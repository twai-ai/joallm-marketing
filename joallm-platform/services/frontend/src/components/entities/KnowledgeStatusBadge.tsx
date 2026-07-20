import React from 'react';
import { AlertCircle, CheckCircle2, Loader2, Clock3 } from 'lucide-react';
import { KnowledgeDocument } from '../../domain/knowledge';

interface KnowledgeStatusBadgeProps {
  status: KnowledgeDocument['status'];
}

export function KnowledgeStatusBadge({ status }: KnowledgeStatusBadgeProps) {
  if (status === 'ready') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
        <CheckCircle2 className="h-3 w-3" />
        Ready
      </span>
    );
  }

  if (status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
        <AlertCircle className="h-3 w-3" />
        Failed
      </span>
    );
  }

  if (status === 'processing') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
        <Loader2 className="h-3 w-3 animate-spin" />
        Indexing
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
      <Clock3 className="h-3 w-3" />
      Uploaded
    </span>
  );
}
