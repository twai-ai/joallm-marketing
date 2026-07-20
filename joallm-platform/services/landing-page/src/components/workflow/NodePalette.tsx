import React from 'react';
import { DivideIcon as LucideIcon } from 'lucide-react';

interface NodeType {
  type: string;
  icon: LucideIcon;
  label: string;
  color: string;
  description: string;
}

interface NodePaletteProps {
  nodeTypes: NodeType[];
}

export function NodePalette({ nodeTypes }: NodePaletteProps) {
  const handleDragStart = (e: React.DragEvent, nodeType: string) => {
    e.dataTransfer.setData('nodeType', nodeType);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-gray-200 bg-white">
        <h3 className="font-semibold text-gray-900">Node Palette</h3>
        <p className="text-xs text-gray-600 mt-1">Drag nodes to the canvas</p>
      </div>
      
      <div className="flex-1 p-4 space-y-2">
        {nodeTypes.map((nodeType) => (
          <div
            key={nodeType.type}
            draggable
            onDragStart={(e) => handleDragStart(e, nodeType.type)}
            className="flex items-center space-x-3 p-3 bg-white border border-gray-200 rounded-lg cursor-grab hover:bg-gray-50 transition-colors"
          >
            <div className={`w-8 h-8 ${nodeType.color} rounded-lg flex items-center justify-center`}>
              <nodeType.icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-medium text-gray-900">{nodeType.label}</div>
              <div className="text-xs text-gray-500">
                {nodeType.description}
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Templates Section */}
      <div className="border-t border-gray-200 p-4 bg-gray-50">
        <h4 className="font-medium text-gray-900 mb-2">Quick Templates</h4>
        <div className="space-y-2">
          <button className="w-full text-left p-2 text-sm bg-white hover:bg-gray-50 border border-gray-200 rounded transition-colors">
            🤖 Simple Chat Bot
          </button>
          <button className="w-full text-left p-2 text-sm bg-white hover:bg-gray-50 border border-gray-200 rounded transition-colors">
            📊 Data Analysis Pipeline
          </button>
          <button className="w-full text-left p-2 text-sm bg-white hover:bg-gray-50 border border-gray-200 rounded transition-colors">
            🔍 RAG Document Q&A
          </button>
        </div>
      </div>
    </div>
  );
}