import React, { useState, useRef, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { useWorkflow, WorkflowNode } from '../../contexts/WorkflowContext';
import { WorkflowNodeComponent } from './WorkflowNodeComponent';

export function WorkflowCanvas() {
  const { activeWorkflow, addNode } = useWorkflow();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current) {
      // Clicked on empty canvas
      const rect = canvasRef.current!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      // Show context menu or add node
    }
  };

  const handleAddNode = (type: WorkflowNode['type'], x: number, y: number) => {
    addNode({
      type,
      name: `${type.charAt(0).toUpperCase() + type.slice(1)} Node`,
      position: { x, y },
      data: {},
      connections: [],
    });
  };

  if (!activeWorkflow) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
            <Plus className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Workflow Selected</h3>
          <p className="text-gray-600 mb-4">Create a new workflow to start building AI-powered automations</p>
          <button
            onClick={() => {
              const name = prompt('Enter workflow name:');
              if (name) {
                // This would be handled by the parent component
              }
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors"
          >
            Create Workflow
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={canvasRef}
      className="h-full w-full bg-gray-50 relative overflow-auto"
      onClick={handleCanvasClick}
      style={{
        backgroundImage: `
          radial-gradient(circle, #d1d5db 1px, transparent 1px)
        `,
        backgroundSize: '20px 20px',
      }}
    >
      {/* Grid Pattern */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(to right, #e5e7eb 1px, transparent 1px),
            linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)
          `,
          backgroundSize: '20px 20px',
        }}
      />

      {/* Workflow Nodes */}
      {activeWorkflow.nodes.map((node) => (
        <WorkflowNodeComponent
          key={node.id}
          node={node}
        />
      ))}

      {/* Connection Lines */}
      <svg
        className="absolute inset-0 pointer-events-none"
        style={{ zIndex: 1 }}
      >
        {activeWorkflow.edges.map((edge) => {
          const sourceNode = activeWorkflow.nodes.find(n => n.id === edge.source);
          const targetNode = activeWorkflow.nodes.find(n => n.id === edge.target);
          
          if (!sourceNode || !targetNode) return null;

          const x1 = sourceNode.position.x + 100; // Node width / 2
          const y1 = sourceNode.position.y + 25;  // Node height / 2
          const x2 = targetNode.position.x + 100;
          const y2 = targetNode.position.y + 25;

          return (
            <line
              key={edge.id}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#3B82F6"
              strokeWidth="2"
              markerEnd="url(#arrowhead)"
            />
          );
        })}
        
        {/* Arrow marker definition */}
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon
              points="0 0, 10 3.5, 0 7"
              fill="#3B82F6"
            />
          </marker>
        </defs>
      </svg>

      {/* Add Node Button (appears on hover) */}
      <div className="absolute bottom-4 right-4">
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleAddNode('llm', 200, 200);
          }}
          className="w-12 h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center justify-center shadow-lg transition-colors"
          title="Add Node"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}