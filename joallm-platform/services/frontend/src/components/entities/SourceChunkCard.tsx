import React, { useState } from 'react';
import { Copy, FileText } from 'lucide-react';
import { KnowledgeSearchResultView } from '../../domain/knowledge';

interface SourceChunkCardProps {
  result: KnowledgeSearchResultView;
  index?: number;
}

const SCORE_STYLES = {
  high: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-red-100 text-red-800',
} as const;

export function SourceChunkCard({ result, index }: SourceChunkCardProps) {
  const [expanded, setExpanded] = useState(false);

  const preview =
    expanded || result.content.length <= 220
      ? result.content
      : `${result.content.slice(0, 220)}...`;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          {typeof index === 'number' && (
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-joa-primary text-xs font-semibold text-white">
              {index + 1}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-gray-500" />
              <p className="font-medium text-gray-900">{result.filename}</p>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Chunk {result.chunkIndex} • Position {result.startChar}-{result.endChar}
            </p>
          </div>
        </div>

        <span
          className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${SCORE_STYLES[result.scoreLabel]}`}
          title="Scores above 80% usually indicate a strong retrieval match."
        >
          {(result.score * 100).toFixed(1)}% match
        </span>
      </div>

      <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/60 p-4 text-sm leading-7 text-gray-700">
        {preview}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <button
          onClick={() => setExpanded((current) => !current)}
          className="text-sm font-medium text-blue-700 hover:text-blue-900"
        >
          {expanded ? 'Show less' : 'Show full chunk'}
        </button>

        <button
          onClick={() => navigator.clipboard?.writeText(result.content)}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 transition hover:bg-gray-50"
        >
          <Copy className="h-4 w-4" />
          Copy text
        </button>
      </div>
    </div>
  );
}
