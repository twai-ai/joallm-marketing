import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Sparkles } from 'lucide-react';
import { useWorkflow, WorkflowNode } from '../../contexts/WorkflowContext';
import { showError } from '../../utils/toast';
import { WorkflowNodeComponent } from './WorkflowNodeComponent';
import { getWorkflowNodeTone, workspaceButton, workspacePanel } from '../workspace/workspaceTheme';

interface WorkflowCanvasProps {
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
  onConfigureNode: (nodeId: string) => void;
  pendingAddNodeType?: WorkflowNode['type'] | null;
  onPendingAddNodeHandled?: () => void;
  draggedNodeType?: WorkflowNode['type'] | null;
  onDraggedNodeHandled?: () => void;
}

export function WorkflowCanvas({
  selectedNodeId,
  onSelectNode,
  onConfigureNode,
  pendingAddNodeType,
  onPendingAddNodeHandled,
  draggedNodeType,
  onDraggedNodeHandled,
}: WorkflowCanvasProps) {
  const { activeWorkflow, addNode, addEdge, deleteNode, updateNode } = useWorkflow();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [connectionStart, setConnectionStart] = useState<string | null>(null);
  const [pointerPosition, setPointerPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const dragDepthRef = useRef(0);

  useEffect(() => {
    if (!connectionStart) {
      return;
    }

    const handlePointerMove = (event: MouseEvent) => {
      setPointerPosition({ x: event.clientX, y: event.clientY });
    };

    const handlePointerUp = () => {
      setConnectionStart(null);
      setPointerPosition(null);
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);

    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
    };
  }, [connectionStart]);

  useEffect(() => {
    if (!pendingAddNodeType || !activeWorkflow) {
      return;
    }

    handleAddNode(pendingAddNodeType, 220, 180);
    onPendingAddNodeHandled?.();
  }, [activeWorkflow, onPendingAddNodeHandled, pendingAddNodeType]);

  const nodeDisplayName = (type: string) =>
    type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  const handleAddNode = (type: WorkflowNode['type'], x: number, y: number) => {
    addNode({
      type,
      name: nodeDisplayName(type),
      position: { x: Math.max(24, x), y: Math.max(24, y) },
      data: {},
      connections: [],
    });
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = 0;
    setIsDragActive(false);
    const nodeType = (
      event.dataTransfer.getData('nodeType') ||
      event.dataTransfer.getData('text/plain') ||
      draggedNodeType ||
      ''
    ) as WorkflowNode['type'];
    if (!nodeType) return;
    if (!activeWorkflow) {
      showError('Create or open a workflow first before adding nodes');
      return;
    }
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    handleAddNode(
      nodeType,
      event.clientX - rect.left - 100 + canvasRef.current.scrollLeft,
      event.clientY - rect.top - 40 + canvasRef.current.scrollTop,
    );
    onDraggedNodeHandled?.();
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
  };

  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current += 1;
    setIsDragActive(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDragActive(false);
    }
  };

  useEffect(() => {
    if (!draggedNodeType || !activeWorkflow || !canvasRef.current) {
      return;
    }

    const isInsideCanvas = (clientX: number, clientY: number) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return false;
      return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
    };

    const handleMouseMove = (event: MouseEvent) => {
      setIsDragActive(isInsideCanvas(event.clientX, event.clientY));
    };

    const handleMouseUp = (event: MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect && isInsideCanvas(event.clientX, event.clientY) && canvasRef.current) {
        handleAddNode(
          draggedNodeType,
          event.clientX - rect.left - 100 + canvasRef.current.scrollLeft,
          event.clientY - rect.top - 40 + canvasRef.current.scrollTop,
        );
      }

      dragDepthRef.current = 0;
      setIsDragActive(false);
      onDraggedNodeHandled?.();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [activeWorkflow, draggedNodeType, onDraggedNodeHandled]);

  const edgePreview = useMemo(() => {
    if (!activeWorkflow || !connectionStart || !pointerPosition || !canvasRef.current) {
      return null;
    }

    const sourceNode = activeWorkflow.nodes.find((node) => node.id === connectionStart);
    if (!sourceNode) {
      return null;
    }

    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x1: sourceNode.position.x + 112,
      y1: sourceNode.position.y + 92,
      x2: pointerPosition.x - rect.left,
      y2: pointerPosition.y - rect.top,
    };
  }, [activeWorkflow, connectionStart, pointerPosition]);

  if (!activeWorkflow) {
    return (
      <div
        className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.08),_transparent_30%),linear-gradient(180deg,_#f8fbff_0%,_#eef3f8_100%)]"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDropCapture={handleDrop}
        onDrop={handleDrop}
      >
        <div className="pointer-events-none text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm">
            <Sparkles className="h-8 w-8 text-blue-500" />
          </div>
          <h3 className="mb-2 text-lg font-medium text-slate-900">No Workflow Selected</h3>
          <p className="text-slate-600">Create a workflow above, then drag nodes here to build.</p>
        </div>
      </div>
    );
  }

  const strokeColor = '#94a3b8';
  const previewColor = '#cbd5e1';

  return (
    <div
      ref={canvasRef}
      className="relative h-full w-full overflow-auto bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.06),_transparent_30%),linear-gradient(180deg,_#f8fbff_0%,_#eef3f8_100%)]"
      onClick={() => onSelectNode(null)}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDropCapture={handleDrop}
      onDrop={handleDrop}
      style={{
        backgroundImage: 'radial-gradient(circle, rgba(148,163,184,0.24) 1px, transparent 1px)',
        backgroundSize: '26px 26px',
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(226,232,240,0.6) 1px, transparent 1px), linear-gradient(to bottom, rgba(226,232,240,0.6) 1px, transparent 1px)',
          backgroundSize: '52px 52px',
        }}
      />

      {isDragActive && (
        <div className="pointer-events-none absolute inset-0 z-20 border-2 border-dashed border-teal-300 bg-teal-50/50">
          <div className="absolute inset-x-0 top-6 flex justify-center">
            <div className="rounded-full border border-teal-200 bg-white/95 px-3 py-1 text-xs font-medium text-teal-700 shadow-sm">
              Drop node to add it to the workflow
            </div>
          </div>
        </div>
      )}

      <div className={`pointer-events-none absolute left-5 top-5 z-10 max-w-sm p-4 ${workspacePanel}`}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Canvas guidance</p>
        <h3 className="mt-2 text-sm font-semibold text-slate-900">Build flows visually, validate them below</h3>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          Drag supported nodes from the palette, connect them into a path, then use the execution inspector to review outputs and failures.
        </p>
      </div>

      {activeWorkflow.nodes.map((node) => (
        <WorkflowNodeComponent
          key={node.id}
          node={node}
          selected={selectedNodeId === node.id}
          onSelect={onSelectNode}
          onDelete={deleteNode}
          onConfigure={onConfigureNode}
          onPositionChange={(nodeId, position) => updateNode(nodeId, { position })}
          onConnectionStart={(nodeId) => {
            onSelectNode(nodeId);
            setConnectionStart(nodeId);
          }}
          onConnectionEnd={(targetNodeId) => {
            if (connectionStart && connectionStart !== targetNodeId) {
              addEdge({ source: connectionStart, target: targetNodeId });
            }
            setConnectionStart(null);
            setPointerPosition(null);
          }}
        />
      ))}

      <svg className="absolute inset-0 pointer-events-none" style={{ zIndex: 5 }}>
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#3B82F6" />
          </marker>
        </defs>

        {activeWorkflow.edges.map((edge) => {
          const sourceNode = activeWorkflow.nodes.find((node) => node.id === edge.source);
          const targetNode = activeWorkflow.nodes.find((node) => node.id === edge.target);

          if (!sourceNode || !targetNode) {
            return null;
          }

          return (
            <line
              key={edge.id}
            x1={sourceNode.position.x + 112}
            y1={sourceNode.position.y + 92}
            x2={targetNode.position.x + 112}
            y2={targetNode.position.y}
            stroke={getWorkflowNodeTone(sourceNode.type).stroke ?? strokeColor}
            strokeWidth="2.5"
            markerEnd="url(#arrowhead)"
          />
          );
        })}

        {edgePreview && (
          <line
            x1={edgePreview.x1}
            y1={edgePreview.y1}
            x2={edgePreview.x2}
            y2={edgePreview.y2}
            stroke={previewColor}
            strokeDasharray="6 4"
            strokeWidth="2"
          />
        )}
      </svg>

      <div className="absolute bottom-4 right-4">
        <button
          onClick={(event) => {
            event.stopPropagation();
            handleAddNode('llm', 220, 180);
          }}
          className={`${workspaceButton.accent} h-12 w-12 rounded-full p-0 shadow-lg`}
          title="Add LLM node"
          aria-label="Add LLM node"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}
