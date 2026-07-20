import React, { useState } from 'react';
import { MessageSquare, Zap, Code, Database, GitBranch, Settings, X, Bot, Bug } from 'lucide-react';
import { useWorkflow, WorkflowNode } from '../../contexts/WorkflowContext';

interface WorkflowNodeComponentProps {
  node: WorkflowNode;
}

const nodeIcons = {
  input: MessageSquare,
  llm: Zap,
  tool: Code,
  condition: GitBranch,
  output: Database,
  knowledge: Database,
  agent: Bot,
  debug: Bug,
};

const nodeColors = {
  input: 'bg-green-500',
  llm: 'bg-blue-500',
  tool: 'bg-purple-500',
  condition: 'bg-orange-500',
  output: 'bg-gray-500',
  knowledge: 'bg-indigo-500',
  agent: 'bg-pink-500',
  debug: 'bg-red-500',
};

export function WorkflowNodeComponent({ node }: WorkflowNodeComponentProps) {
  const { updateNode, deleteNode } = useWorkflow();
  const [isDragging, setIsDragging] = useState(false);
  const [isSelected, setIsSelected] = useState(false);

  const Icon = nodeIcons[node.type];
  const colorClass = nodeColors[node.type];

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setIsSelected(true);
    e.preventDefault();
  };

  const handleDelete = () => {
    deleteNode(node.id);
  };

  return (
    <div
      className={`absolute w-48 bg-white border rounded-lg shadow-md transition-all cursor-move ${
        isSelected ? 'ring-2 ring-blue-500' : ''
      } ${isDragging ? 'z-10' : 'z-0'}`}
      style={{
        left: node.position.x,
        top: node.position.y,
      }}
      onMouseDown={handleMouseDown}
      onClick={() => setIsSelected(true)}
    >
      {/* Node Header */}
      <div className={`${colorClass} text-white p-3 rounded-t-lg flex items-center justify-between`}>
        <div className="flex items-center space-x-2">
          <Icon className="w-5 h-5" />
          <span className="font-medium text-sm">{node.type.charAt(0).toUpperCase() + node.type.slice(1)}</span>
        </div>
        
        <div className="flex items-center space-x-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              // Open settings
            }}
            className="p-1 hover:bg-white/20 rounded transition-colors"
          >
            <Settings className="w-4 h-4" />
          </button>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDelete();
            }}
            className="p-1 hover:bg-white/20 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {/* Node Content */}
      <div className="p-3">
        <div className="text-sm font-medium text-gray-900 mb-2">{node.name}</div>
        
        {node.type === 'input' && (
          <div className="text-xs text-gray-600">
            <div>Input Type: Text</div>
            <div>Required: Yes</div>
          </div>
        )}
        
        {node.type === 'llm' && (
          <div className="text-xs text-gray-600">
            <div>Model: GPT-4</div>
            <div>Temperature: 0.7</div>
          </div>
        )}
        
        {node.type === 'tool' && (
          <div className="text-xs text-gray-600">
            <div>Tool: Web Search</div>
            <div>Max Results: 5</div>
          </div>
        )}
        
        {node.type === 'condition' && (
          <div className="text-xs text-gray-600">
            <div>Condition: If/Else</div>
            <div>Logic: Contains</div>
          </div>
        )}
        
        {node.type === 'output' && (
          <div className="text-xs text-gray-600">
            <div>Format: JSON</div>
            <div>Destination: API</div>
          </div>
        )}
        
        {node.type === 'knowledge' && (
          <div className="text-xs text-gray-600">
            <div>Source: Document Store</div>
            <div>Chunks: Top 5</div>
          </div>
        )}
        
        {node.type === 'agent' && (
          <div className="text-xs text-gray-600">
            <div>Tools: 3 enabled</div>
            <div>Memory: Persistent</div>
          </div>
        )}
        
        {node.type === 'debug' && (
          <div className="text-xs text-gray-600">
            <div>Mode: Real-time</div>
            <div>Logs: Enabled</div>
          </div>
        )}
      </div>
      
      {/* Connection Points */}
      <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-4 h-4 bg-gray-300 border border-white rounded-full" />
      <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-4 h-4 bg-gray-300 border border-white rounded-full" />
    </div>
  );
}