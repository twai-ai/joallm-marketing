import React, { useState } from 'react';
import { Copy, Edit2, RefreshCw, Trash2, Share2, Check } from 'lucide-react';
import { showSuccess } from '../../utils/toast';

interface MessageActionsProps {
  messageId: string;
  content: string;
  onEdit?: (messageId: string) => void;
  onRegenerate?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
  onShare?: (messageId: string) => void;
}

export function MessageActions({
  messageId,
  content,
  onEdit,
  onRegenerate,
  onDelete,
  onShare,
}: MessageActionsProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      showSuccess('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  return (
    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      <button
        onClick={handleCopy}
        className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
        title="Copy message"
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-green-600" />
        ) : (
          <Copy className="w-3.5 h-3.5 text-gray-600" />
        )}
      </button>

      {onEdit && (
        <button
          onClick={() => onEdit(messageId)}
          className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
          title="Edit message"
        >
          <Edit2 className="w-3.5 h-3.5 text-gray-600" />
        </button>
      )}

      {onRegenerate && (
        <button
          onClick={() => onRegenerate(messageId)}
          className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
          title="Regenerate response"
        >
          <RefreshCw className="w-3.5 h-3.5 text-gray-600" />
        </button>
      )}

      {onShare && (
        <button
          onClick={() => onShare(messageId)}
          className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
          title="Share message"
        >
          <Share2 className="w-3.5 h-3.5 text-gray-600" />
        </button>
      )}

      {onDelete && (
        <button
          onClick={() => {
            if (confirm('Delete this message?')) {
              onDelete(messageId);
            }
          }}
          className="p-1.5 rounded-md hover:bg-red-50 transition-colors"
          title="Delete message"
        >
          <Trash2 className="w-3.5 h-3.5 text-red-600" />
        </button>
      )}
    </div>
  );
}


