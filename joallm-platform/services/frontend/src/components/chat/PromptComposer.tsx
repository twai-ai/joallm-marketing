import React, { useRef, useEffect, useState } from 'react';
import { AudioLines, BrainCircuit, Eye, Paperclip, Send, Sparkles, Database, FileSearch, Info } from 'lucide-react';
import { MODALITY_CAPABILITIES, MULTIMODAL_PROCESSING_MODES, type ModalityCapabilityId, type MultimodalProcessingMode } from '../../constants/modalities';

interface PromptComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onKeyPress?: (e: React.KeyboardEvent) => void;
  isLoading: boolean;
  placeholder?: string;
  onAttachFile?: () => void;
  onRAGContext?: () => void;
  hasAttachments?: boolean;
  hasRAGContext?: boolean;
  selectedModalities?: ModalityCapabilityId[];
  onSelectedModalitiesChange?: (modalities: ModalityCapabilityId[]) => void;
  processingMode?: MultimodalProcessingMode;
  onProcessingModeChange?: (mode: MultimodalProcessingMode) => void;
}

export function PromptComposer({
  value,
  onChange,
  onSend,
  onKeyPress,
  isLoading,
  placeholder = "Type your message...",
  onAttachFile,
  onRAGContext,
  hasAttachments = false,
  hasRAGContext = false,
  selectedModalities = [],
  onSelectedModalitiesChange,
  processingMode = 'analyze_directly',
  onProcessingModeChange,
}: PromptComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showPipelineHelp, setShowPipelineHelp] = useState(false);
  const modalityIcons = {
    vision: Eye,
    speech: AudioLines,
    document_intelligence: FileSearch,
    multimodal_reasoning: BrainCircuit,
  } satisfies Record<ModalityCapabilityId, React.ElementType>;

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
    }
  }, [value]);

  const toggleModality = (id: ModalityCapabilityId) => {
    if (!onSelectedModalitiesChange) return;
    onSelectedModalitiesChange(
      selectedModalities.includes(id)
        ? selectedModalities.filter((item) => item !== id)
        : [...selectedModalities, id]
    );
  };

  return (
    <div className="relative">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {MODALITY_CAPABILITIES.map((capability) => {
          const Icon = modalityIcons[capability.id];
          const active = selectedModalities.includes(capability.id);
          return (
            <button
              key={capability.id}
              type="button"
              onClick={() => toggleModality(capability.id)}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium transition ${
                active
                  ? capability.accentClass
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900'
              }`}
              title={capability.description}
            >
              <Icon className="h-3.5 w-3.5" />
              {capability.shortLabel}
            </button>
          );
        })}
      </div>

      <div className="mb-3 rounded-2xl border border-gray-200 bg-white/90 p-3 shadow-sm">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
            <Sparkles className="h-3.5 w-3.5 text-joa-primary" />
            How Should JoaLLM Handle This Input?
          </div>
          <button
            type="button"
            onClick={() => setShowPipelineHelp((current) => !current)}
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
            aria-label="How to use multimodal pipeline modes"
            title="How to use these modes"
          >
            <Info className="h-3.5 w-3.5" />
            Help
          </button>
        </div>
        {showPipelineHelp && (
          <div className="mb-3 rounded-xl border border-teal-100 bg-red-50/50 px-3 py-3 text-xs leading-5 text-slate-600">
            <p className="font-medium text-slate-800">How to use these modes</p>
            <p className="mt-1">
              <span className="font-medium text-slate-700">Answer now:</span> use the attachment in the current chat reply.
            </p>
            <p>
              <span className="font-medium text-slate-700">Extract first:</span> pull out text, fields, layout, or transcript before reasoning.
            </p>
            <p>
              <span className="font-medium text-slate-700">Save for reuse:</span> best for content you want searchable later. For chat text, use <span className="font-medium">Save to Knowledge</span> on the message.
            </p>
            <p>
              <span className="font-medium text-slate-700">Turn into workflow:</span> best for reusable automation. The most reliable path today is <span className="font-medium">Route to Workflow</span> on the message after it appears in chat.
            </p>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {MULTIMODAL_PROCESSING_MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => onProcessingModeChange?.(mode.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                processingMode === mode.id
                  ? 'border-joa-primary bg-teal-50 text-joa-primary'
                  : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300 hover:bg-white'
              }`}
              title={mode.description}
            >
              {mode.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] leading-5 text-gray-500">
          Choose the handling mode before you send. After the reply arrives, JoaLLM can suggest the next best action for saving or operationalizing the result.
        </p>
      </div>

      {/* Textarea */}
      <div className="relative border border-gray-300 rounded-lg bg-white shadow-sm focus-within:ring-2 focus-within:ring-joa-primary focus-within:border-joa-primary">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          placeholder={placeholder}
          className="w-full px-4 py-3 pr-20 resize-none border-0 rounded-lg focus:outline-none focus:ring-0 min-h-[50px] max-h-[200px]"
          disabled={isLoading}
        />
        
        {/* Action Buttons */}
        <div className="absolute right-2 bottom-2 flex items-center gap-1">
          {/* RAG Context Button */}
          {onRAGContext && (
            <button
              onClick={onRAGContext}
              className={`p-2 rounded-md transition-colors ${
                hasRAGContext 
                  ? 'bg-joa-primary text-white' 
                  : 'text-gray-400 hover:text-joa-primary hover:bg-teal-50'
              }`}
              title="Add Knowledge Base Context"
            >
              <Database className="w-4 h-4" />
            </button>
          )}

          {/* File Attachment Button */}
          {onAttachFile && (
            <button
              onClick={onAttachFile}
              className={`p-2 rounded-md transition-colors ${
                hasAttachments 
                  ? 'bg-joa-primary text-white' 
                  : 'text-gray-400 hover:text-joa-primary hover:bg-teal-50'
              }`}
              title="Attach Files"
            >
              <Paperclip className="w-4 h-4" />
            </button>
          )}

          {/* Send Button */}
          <button
            onClick={onSend}
            disabled={!value.trim() || isLoading}
            className="p-2 rounded-md bg-joa-primary text-white hover:bg-teal-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1">
          <FileSearch className="h-3.5 w-3.5" />
          PDFs, forms, images, audio, and video-ready attachments
        </span>
      </div>
    </div>
  );
}
