import React from 'react';
import { GripVertical } from 'lucide-react';
import { DivideIcon as LucideIcon } from 'lucide-react';
import { cx, getWorkflowNodeTone } from '../workspace/workspaceTheme';

interface NodeType {
  type: string;
  icon: LucideIcon;
  label: string;
  color: string;
  description: string;
}

interface NodePaletteProps {
  nodeTypes: NodeType[];
  onAddNode?: (nodeType: string) => void;
  onDragNodeStart?: (nodeType: string) => void;
  onDragNodeEnd?: () => void;
}

export function NodePalette({ nodeTypes, onAddNode, onDragNodeStart, onDragNodeEnd }: NodePaletteProps) {
  const handleDragStart = (e: React.DragEvent, nodeType: string) => {
    e.dataTransfer.setData('nodeType', nodeType);
    e.dataTransfer.setData('text/plain', nodeType);
    e.dataTransfer.effectAllowed = 'copy';
    onDragNodeStart?.(nodeType);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-3 pt-3 pb-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
          Drag to canvas
        </p>
      </div>

      <ul role="list" className="flex-1 space-y-1 overflow-y-auto px-2 pb-3">
        {nodeTypes.map((nodeType) => {
          const tone = getWorkflowNodeTone(nodeType.type);
          return (
            <li
              key={nodeType.type}
              draggable
              onMouseDown={(event) => {
                if (event.button !== 0) return;
                onDragNodeStart?.(nodeType.type);
              }}
              onDragStart={(e) => handleDragStart(e, nodeType.type)}
              onDragEnd={() => onDragNodeEnd?.()}
              onDoubleClick={() => onAddNode?.(nodeType.type)}
              role="listitem"
              aria-label={`${nodeType.label} node — ${nodeType.description}`}
              className={cx(
                'group flex items-center gap-2.5 rounded-xl border border-slate-200/70 bg-white px-2.5 py-2',
                'cursor-grab select-none transition-all',
                'hover:border-slate-300 hover:shadow-sm hover:-translate-y-0.5',
                'active:cursor-grabbing active:translate-y-0 active:shadow-none'
              )}
            >
              {/* Colour tile */}
              <div className={cx(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-sm',
                tone.tile
              )}>
                <nodeType.icon className="w-4 h-4" />
              </div>

              {/* Label + description */}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800 leading-tight">{nodeType.label}</p>
                <p className="text-[11px] text-slate-400 leading-snug truncate">{nodeType.description}</p>
                {onAddNode && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onAddNode(nodeType.type);
                    }}
                    className="mt-1 text-[11px] font-medium text-slate-500 transition-colors hover:text-slate-700"
                  >
                    Add to canvas
                  </button>
                )}
              </div>

              {/* Drag handle indicator */}
              <GripVertical className="w-3.5 h-3.5 shrink-0 text-slate-300 group-hover:text-slate-400 transition-colors" />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
