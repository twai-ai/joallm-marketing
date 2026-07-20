import React from 'react';
import { Settings, X } from 'lucide-react';
import { WorkflowNode } from '../../contexts/WorkflowContext';
import { getWorkflowNodeTypeMeta } from './workflowNodeCatalog';
import { cx, getWorkflowNodeTone } from '../workspace/workspaceTheme';

interface WorkflowNodeComponentProps {
  node: WorkflowNode;
  selected: boolean;
  onSelect: (nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onConfigure: (nodeId: string) => void;
  onPositionChange: (nodeId: string, position: { x: number; y: number }) => void;
  onConnectionStart: (nodeId: string) => void;
  onConnectionEnd: (nodeId: string) => void;
}

const getNodeSummary = (node: WorkflowNode) => {
  const data = node.data || {};
  switch (node.type) {
    case 'input':
      return ['Workflow input', `Required: ${data.required ? 'Yes' : 'No'}`];
    case 'llm':
      return [`Model: ${data.model || 'claude-haiku-4-5-20251001'}`, `Prompt: ${data.prompt ? 'Configured' : 'Not set'}`];
    case 'rag':
      return [`Query: ${data.query ? 'Configured' : 'Not set'}`, `Files: ${Array.isArray(data.fileIds) ? data.fileIds.length : 0}`];
    case 'conditional':
      return [`Operator: ${data.operator || 'equals'}`, `Compare to: ${data.compareTo || '...'}`];
    case 'transform':
      return [`Transform: ${data.transformType || 'text'}`, `Template: ${data.template ? 'Configured' : 'Not set'}`];
    case 'output':
      return [`Source node: ${data.sourceNodeId || 'Workflow result'}`, 'Emits the final output payload'];
    case 'media_ingest':
      return [
        `File: ${data.fileId ? data.fileId.slice(0, 12) + '…' : 'Not set'}`,
        'Prepares media for AI analysis',
      ];
    case 'transcribe':
      return ['Groq Whisper transcription', 'Enqueues audio extraction job'];
    case 'media_insights':
      return ['AI insight generation', 'Requires upstream Transcribe node'];
    case 'clip':
      return [
        `Start: ${data.startTime ?? 0}s  End: ${data.endTime ?? '—'}s`,
        'Creates a lightweight clip export',
      ];
    case 'artifact_out':
      return ['Returns transcript + insights', 'Final node in media analysis flows'];
    case 'tool':
    case 'condition':
    case 'knowledge':
    case 'agent':
    case 'debug':
      return ['Legacy node', 'Not executed by the current backend'];
    default:
      return [];
  }
};

export function WorkflowNodeComponent({
  node,
  selected,
  onSelect,
  onDelete,
  onConfigure,
  onPositionChange,
  onConnectionStart,
  onConnectionEnd,
}: WorkflowNodeComponentProps) {
  const meta = getWorkflowNodeTypeMeta(node.type);
  const Icon = meta.icon;
  const tone = getWorkflowNodeTone(node.type);
  const summary = getNodeSummary(node);

  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    const startX = event.clientX;
    const startY = event.clientY;
    const initialPosition = node.position;

    onSelect(node.id);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      onPositionChange(node.id, {
        x: Math.max(24, initialPosition.x + deltaX),
        y: Math.max(24, initialPosition.y + deltaY),
      });
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div
      className={cx(
        'absolute w-60 overflow-hidden rounded-2xl border bg-white/96 shadow-[0_18px_36px_rgba(15,23,42,0.12)] transition-all backdrop-blur-sm',
        selected ? 'border-blue-300 ring-2 ring-blue-200' : 'border-slate-200'
      )}
      style={{ left: node.position.x, top: node.position.y, zIndex: selected ? 20 : 10 }}
      onClick={() => onSelect(node.id)}
    >
      <div
        className={cx(
          'flex cursor-move items-center justify-between bg-gradient-to-br p-3 text-white',
          tone.tile
        )}
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center space-x-2">
          <Icon className="w-5 h-5" />
          <span className="font-medium text-sm">{meta.label}</span>
        </div>

        <div className="flex items-center space-x-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onConfigure(node.id);
            }}
            className="p-1 hover:bg-white/20 rounded transition-colors"
            title="Configure node"
          >
            <Settings className="w-4 h-4" />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(node.id);
            }}
            className="p-1 hover:bg-white/20 rounded transition-colors"
            title="Delete node"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="space-y-2 p-4">
        <div className="text-sm font-medium text-slate-900">{node.name}</div>
        {!meta.supported && (
          <div className="text-xs font-semibold uppercase tracking-wide text-amber-600">
            Legacy node
          </div>
        )}
        {summary.map((line) => (
          <div key={line} className="text-xs leading-5 text-slate-600">
            {line}
          </div>
        ))}
      </div>

      <button
        className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-white shadow-sm"
        style={{ backgroundColor: tone.preview }}
        onMouseUp={(e) => {
          e.stopPropagation();
          onConnectionEnd(node.id);
        }}
        title="Drop connection here"
      />
      <button
        className="absolute -bottom-2 left-1/2 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-white shadow-sm"
        style={{ backgroundColor: tone.stroke }}
        onMouseDown={(e) => {
          e.stopPropagation();
          onConnectionStart(node.id);
        }}
        title="Drag to connect"
      />
    </div>
  );
}
