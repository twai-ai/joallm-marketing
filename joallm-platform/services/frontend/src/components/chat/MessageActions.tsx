import React, { useEffect, useState } from 'react';
import { Copy, Edit2, RefreshCw, Trash2, Share2, Check, ThumbsUp, ThumbsDown, Database, Workflow } from 'lucide-react';
import { API_ENDPOINTS } from '../../config/api';
import { feedbackApi, type FeedbackRating } from '../../services/feedbackApi';
import { apiClient } from '../../utils/api-client';
import { showError, showSuccess } from '../../utils/toast';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface MessageActionsProps {
  messageId: string;
  content: string;
  enableFeedback?: boolean;
  onEdit?: (messageId: string) => void;
  onRegenerate?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
  onShare?: (messageId: string) => void;
  onRouteToWorkflow?: (messageId: string) => void;
}

export function MessageActions({
  messageId,
  content,
  enableFeedback = false,
  onEdit,
  onRegenerate,
  onDelete,
  onShare,
  onRouteToWorkflow,
}: MessageActionsProps) {
  const [copied, setCopied] = useState(false);
  const [rating, setRating] = useState<FeedbackRating | null>(null);
  const [isSavingToKnowledge, setIsSavingToKnowledge] = useState(false);
  const isPersistedMessage = UUID_PATTERN.test(messageId);

  useEffect(() => {
    if (!enableFeedback || !isPersistedMessage) {
      setRating(null);
      return;
    }

    let cancelled = false;

    const hydrateFeedback = async () => {
      try {
        const existingFeedback = await feedbackApi.getFeedback(messageId);
        if (!cancelled) {
          setRating(existingFeedback?.rating ?? null);
        }
      } catch {
        if (!cancelled) {
          setRating(null);
        }
      }
    };

    void hydrateFeedback();

    return () => {
      cancelled = true;
    };
  }, [enableFeedback, isPersistedMessage, messageId]);

  const trackSignal = (signal: 'copied' | 'regenerated') => {
    void apiClient.patch(
      API_ENDPOINTS.chat.messageSignal(messageId),
      { signal },
      { showErrorToast: false, retries: 0 },
    ).catch(() => undefined);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      showSuccess('Copied to clipboard');
      trackSignal('copied');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleRatingToggle = async (nextRating: FeedbackRating) => {
    if (!isPersistedMessage) {
      showError('Please wait a moment while this message is being saved.');
      return;
    }

    try {
      if (rating === nextRating) {
        await feedbackApi.deleteFeedback(messageId);
        setRating(null);
        return;
      }

      await feedbackApi.submitFeedback(messageId, { rating: nextRating });
      setRating(nextRating);
    } catch (error) {
      console.error('Failed to update feedback:', error);
    }
  };

  const handleRegenerate = () => {
    trackSignal('regenerated');
    onRegenerate?.(messageId);
  };

  const handleSaveToKnowledge = async () => {
    if (!isPersistedMessage) {
      showError('Please wait a moment while this message is being saved.');
      return;
    }

    try {
      setIsSavingToKnowledge(true);
      const response = await apiClient.post<{ file: { filename: string } }>(
        API_ENDPOINTS.chat.saveMessageToKnowledge(messageId),
        {},
      );
      showSuccess(`Saved to Knowledge as ${response.file.filename}`);
    } catch (error: any) {
      showError(error?.message || 'Failed to save message to Knowledge');
    } finally {
      setIsSavingToKnowledge(false);
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

      {enableFeedback && isPersistedMessage && (
        <>
          <button
            onClick={() => void handleRatingToggle('thumbs_up')}
            className={`p-1.5 rounded-md transition-colors ${
              rating === 'thumbs_up' ? 'bg-green-50 text-green-700' : 'hover:bg-gray-100 text-gray-600'
            }`}
            title="Helpful response"
          >
            <ThumbsUp className="w-3.5 h-3.5" fill={rating === 'thumbs_up' ? 'currentColor' : 'none'} />
          </button>

          <button
            onClick={() => void handleRatingToggle('thumbs_down')}
            className={`p-1.5 rounded-md transition-colors ${
              rating === 'thumbs_down' ? 'bg-red-50 text-red-700' : 'hover:bg-gray-100 text-gray-600'
            }`}
            title="Unhelpful response"
          >
            <ThumbsDown className="w-3.5 h-3.5" fill={rating === 'thumbs_down' ? 'currentColor' : 'none'} />
          </button>
        </>
      )}

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
          onClick={handleRegenerate}
          className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
          title="Regenerate response"
        >
          <RefreshCw className="w-3.5 h-3.5 text-gray-600" />
        </button>
      )}

      <button
        onClick={() => void handleSaveToKnowledge()}
        disabled={isSavingToKnowledge}
        className="p-1.5 rounded-md hover:bg-teal-50 transition-colors disabled:opacity-50"
        title="Save to Knowledge"
      >
        <Database className="w-3.5 h-3.5 text-joa-primary" />
      </button>

      {onRouteToWorkflow && (
        <button
          onClick={() => onRouteToWorkflow(messageId)}
          className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
          title="Route to Workflow"
        >
          <Workflow className="w-3.5 h-3.5 text-gray-600" />
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
          className="p-1.5 rounded-md hover:bg-teal-50 transition-colors"
          title="Delete message"
        >
          <Trash2 className="w-3.5 h-3.5 text-red-600" />
        </button>
      )}
    </div>
  );
}
