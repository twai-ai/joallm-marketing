import React from 'react';
import { X } from 'lucide-react';
import { WorkflowNode } from '../../contexts/WorkflowContext';
import { getWorkflowNodeTypeMeta } from './workflowNodeCatalog';
import { getWorkflowNodeTone, workspaceInput, workspaceSectionLabel, workspaceTextarea } from '../workspace/workspaceTheme';
import { DEFAULT_MEDIA_INTELLIGENCE_MODE, MEDIA_INTELLIGENCE_MODES } from '../../constants/mediaIntelligenceModes';

interface WorkflowNodeSettingsProps {
  node: WorkflowNode;
  onClose: () => void;
  onUpdate: (data: Partial<WorkflowNode>) => void;
  availableNodes?: WorkflowNode[];
}

const labelClass = 'block text-xs font-semibold text-slate-600 mb-1';
const hintClass = 'mt-1 text-[11px] text-slate-400 leading-relaxed';

export function WorkflowNodeSettings({ node, onClose, onUpdate, availableNodes = [] }: WorkflowNodeSettingsProps) {
  const meta = getWorkflowNodeTypeMeta(node.type);
  const data = node.data || {};
  const tone = getWorkflowNodeTone(node.type);

  const updateData = (patch: Record<string, any>) => {
    onUpdate({ data: { ...data, ...patch } });
  };

  const renderFields = () => {
    switch (node.type) {
      case 'input':
        return (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-600 leading-relaxed">
            This is the workflow entry point. Anything passed when the workflow is executed becomes available as{' '}
            <code className="rounded bg-slate-200 px-1 py-0.5 font-mono text-slate-700">{'{{input}}'}</code>{' '}
            in downstream nodes.
          </div>
        );

      case 'llm':
        return (
          <>
            <div>
              <label className={labelClass}>Prompt</label>
              <textarea
                value={data.prompt || ''}
                onChange={(e) => updateData({ prompt: e.target.value })}
                rows={6}
                placeholder="What should this step generate? Use {{nodeId}} to reference upstream outputs."
                className={workspaceTextarea}
                aria-label="LLM prompt"
              />
              <p className={hintClass}>Use <code className="font-mono">{'{{nodeId}}'}</code> to pipe in upstream results.</p>
            </div>

            <div>
              <label className={labelClass}>Model</label>
              <select
                value={data.model || 'claude-haiku-4-5-20251001'}
                onChange={(e) => updateData({ model: e.target.value })}
                className={workspaceInput}
                aria-label="LLM model"
              >
                <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5 (fast)</option>
                <option value="claude-sonnet-4-6">Claude Sonnet 4.6</option>
                <option value="gpt-4o-mini">GPT-4o mini (fast)</option>
                <option value="gpt-4o">GPT-4o</option>
                <option value="llama-3.3-70b">Llama 3.3 70B (open)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Max tokens</label>
                <input
                  type="number"
                  min={64}
                  max={8192}
                  value={data.maxTokens ?? 1024}
                  onChange={(e) => updateData({ maxTokens: Number(e.target.value) })}
                  className={workspaceInput}
                  aria-label="Max tokens"
                />
              </div>
              <div>
                <label className={labelClass}>Temperature</label>
                <input
                  type="number"
                  min={0}
                  max={2}
                  step="0.1"
                  value={data.temperature ?? 0.7}
                  onChange={(e) => updateData({ temperature: Number(e.target.value) })}
                  className={workspaceInput}
                  aria-label="Temperature"
                />
                <p className={hintClass}>0 = precise, 1 = creative</p>
              </div>
            </div>
          </>
        );

      case 'rag':
        return (
          <>
            <div>
              <label className={labelClass}>Query</label>
              <textarea
                value={data.query || ''}
                onChange={(e) => updateData({ query: e.target.value })}
                rows={3}
                placeholder="What context should this step retrieve? Use {{input}} or upstream node IDs."
                className={workspaceTextarea}
                aria-label="RAG query"
              />
            </div>

            <div>
              <label className={labelClass}>Knowledge sources</label>
              <input
                type="text"
                value={Array.isArray(data.fileIds) ? data.fileIds.join(', ') : ''}
                onChange={(e) =>
                  updateData({
                    fileIds: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                  })
                }
                placeholder="file-uuid-1, file-uuid-2"
                className={workspaceInput}
                aria-label="File IDs"
              />
              <p className={hintClass}>Paste file IDs from your knowledge base. Leave blank to search all uploaded files.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Result limit</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={data.limit ?? 5}
                  onChange={(e) => updateData({ limit: Number(e.target.value) })}
                  className={workspaceInput}
                  aria-label="Result limit"
                />
              </div>
              <div>
                <label className={labelClass}>Min score</label>
                <input
                  type="number"
                  min={0}
                  max={1}
                  step="0.05"
                  value={data.threshold ?? 0.1}
                  onChange={(e) => updateData({ threshold: Number(e.target.value) })}
                  className={workspaceInput}
                  aria-label="Similarity threshold"
                />
                <p className={hintClass}>0.1 = broad, 0.7 = strict</p>
              </div>
            </div>
          </>
        );

      case 'conditional':
        return (
          <>
            <div>
              <label className={labelClass}>Value to test</label>
              <input
                type="text"
                value={data.value || ''}
                onChange={(e) => updateData({ value: e.target.value })}
                placeholder="{{result}}"
                className={workspaceInput}
                aria-label="Value"
              />
              <p className={hintClass}>Use <code className="font-mono">{'{{nodeId}}'}</code> to reference an upstream output.</p>
            </div>

            <div>
              <label className={labelClass}>Operator</label>
              <select
                value={data.operator || 'equals'}
                onChange={(e) => updateData({ operator: e.target.value })}
                className={workspaceInput}
                aria-label="Comparison operator"
              >
                <option value="equals">equals</option>
                <option value="not_equals">does not equal</option>
                <option value="contains">contains</option>
                <option value="greater_than">is greater than</option>
                <option value="less_than">is less than</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>Compare to</label>
              <input
                type="text"
                value={data.compareTo || ''}
                onChange={(e) => updateData({ compareTo: e.target.value })}
                placeholder="expected value"
                className={workspaceInput}
                aria-label="Compare to value"
              />
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-500 leading-relaxed">
              Connect <span className="font-semibold text-slate-700">truePath</span> and{' '}
              <span className="font-semibold text-slate-700">falsePath</span> handles on the canvas to route
              execution based on the result.
            </div>
          </>
        );

      case 'transform':
        return (
          <>
            <div>
              <label className={labelClass}>Template</label>
              <textarea
                value={data.template || ''}
                onChange={(e) => updateData({ template: e.target.value })}
                rows={3}
                placeholder="{{result}}"
                className={workspaceTextarea}
                aria-label="Transform template"
              />
              <p className={hintClass}>Reference any upstream node using <code className="font-mono">{'{{nodeId}}'}</code>.</p>
            </div>

            <div>
              <label className={labelClass}>Operation</label>
              <select
                value={data.transformType || 'text'}
                onChange={(e) => updateData({ transformType: e.target.value })}
                className={workspaceInput}
                aria-label="Transform type"
              >
                <option value="text">Pass through (no-op)</option>
                <option value="uppercase">Uppercase</option>
                <option value="lowercase">Lowercase</option>
                <option value="trim">Trim whitespace</option>
                <option value="json_parse">Parse JSON</option>
              </select>
            </div>
          </>
        );

      case 'output': {
        const nodeOptions = availableNodes.filter(n => n.type !== 'output');
        return (
          <div>
            <label className={labelClass}>Source node</label>
            {nodeOptions.length > 0 ? (
              <select
                value={data.sourceNodeId || ''}
                onChange={(e) => updateData({ sourceNodeId: e.target.value })}
                className={workspaceInput}
                aria-label="Source node"
              >
                <option value="">— last completed node —</option>
                {nodeOptions.map(n => (
                  <option key={n.id} value={n.id}>{n.name} ({n.type})</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={data.sourceNodeId || ''}
                onChange={(e) => updateData({ sourceNodeId: e.target.value })}
                placeholder="Leave blank to use the last node's result"
                className={workspaceInput}
                aria-label="Source node ID"
              />
            )}
            <p className={hintClass}>The selected node's result will be the final workflow output.</p>
          </div>
        );
      }

      // ── Media intelligence nodes ─────────────────────────────────────

      case 'media_ingest':
        return (
          <div>
            <label className={labelClass}>File ID</label>
            <input
              type="text"
              value={data.fileId || ''}
              onChange={(e) => updateData({ fileId: e.target.value })}
              placeholder="UUID of uploaded media file"
              className={workspaceInput}
              aria-label="Media file ID"
            />
            <p className={hintClass}>Paste the file ID from the knowledge base after uploading a video or audio file for AI analysis.</p>
          </div>
        );

      case 'transcribe':
        return (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-600 leading-relaxed">
            Enqueues a transcription job for the file from the upstream <span className="font-semibold">Media Ingest</span> node.
            Uses Whisper (Groq) to produce time-coded transcript segments for downstream AI steps.
          </div>
        );

      case 'media_insights':
        return (
          <>
            <div>
              <label className={labelClass}>Intelligence mode</label>
              <select
                value={data.intelligenceMode || DEFAULT_MEDIA_INTELLIGENCE_MODE}
                onChange={(e) => updateData({ intelligenceMode: e.target.value })}
                className={workspaceInput}
                aria-label="Media intelligence mode"
              >
                {MEDIA_INTELLIGENCE_MODES.map((mode) => (
                  <option key={mode.id} value={mode.id}>
                    {mode.label}
                  </option>
                ))}
              </select>
              <p className={hintClass}>
                Choose the analysis lens for this media run. The same asset can be re-used later with another mode.
              </p>
            </div>
            <div>
              <label className={labelClass}>Insight model</label>
              <select
                value={data.model || 'llama-3.1-8b-instant'}
                onChange={(e) => updateData({ model: e.target.value })}
                className={workspaceInput}
                aria-label="Media insight model"
              >
                <option value="llama-3.1-8b-instant">Llama 3.1 8B Instant (Groq, recommended)</option>
                <option value="openai/gpt-oss-20b">GPT-OSS 20B (Groq)</option>
                <option value="llama-3.3-70b-versatile">Llama 3.3 70B Versatile (Groq)</option>
              </select>
              <p className={hintClass}>
                Lower-cost models are more reliable for long videos. Heavier models can produce richer insight wording,
                but they are more likely to hit Groq rate limits on large transcripts.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-600 leading-relaxed">
              Runs AI analysis over the transcript to produce highlights, key moments, topics, and action items.
              Requires a <span className="font-semibold">Transcribe</span> node upstream.
            </div>
          </>
        );

      case 'clip':
        return (
          <>
            <div>
              <label className={labelClass}>Start time (seconds)</label>
              <input
                type="number"
                min={0}
                step="0.1"
                value={data.startTime ?? 0}
                onChange={(e) => updateData({ startTime: Number(e.target.value) })}
                className={workspaceInput}
                aria-label="Clip start time"
              />
            </div>
            <div>
              <label className={labelClass}>End time (seconds)</label>
              <input
                type="number"
                min={0}
                step="0.1"
                value={data.endTime ?? ''}
                onChange={(e) => updateData({ endTime: Number(e.target.value) })}
                placeholder="e.g. 120"
                className={workspaceInput}
                aria-label="Clip end time"
              />
            </div>
            <p className={hintClass}>Use this for lightweight clip exports or downstream automation, not timeline editing.</p>
          </>
        );

      case 'artifact_out':
        return (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-600 leading-relaxed">
            Reads transcript segments and AI insights for the media file and returns a summary payload.
            Use this as the final node in a media analysis pipeline to confirm the analysis is complete.
          </div>
        );

      default:
        return (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
            This is a legacy node type. It will be skipped by the current executor.
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col bg-white/85 backdrop-blur-xl">
      {/* Panel header */}
      <div className="border-b border-slate-200/80 px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <p className={workspaceSectionLabel}>Node settings</p>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close node settings"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${tone.soft}`}>
          <meta.icon className="h-3 w-3" />
          {meta.label}
        </div>
      </div>

      {/* Fields */}
      <div className="space-y-4 p-4">
        {!meta.supported && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
            Legacy node — preserved for compatibility but not executed by the current backend.
          </div>
        )}

        <div>
          <label className={labelClass}>Node name</label>
          <input
            type="text"
            value={node.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            className={workspaceInput}
            aria-label="Node name"
          />
        </div>

        {renderFields()}
      </div>
    </div>
  );
}
