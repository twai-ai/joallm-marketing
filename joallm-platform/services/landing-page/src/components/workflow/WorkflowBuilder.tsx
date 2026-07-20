import React, { useState } from 'react';
import { Plus, Play, Save, Settings, Zap, Database, MessageSquare, Code, GitBranch, Bot, Bug } from 'lucide-react';
import { WorkflowCanvas } from './WorkflowCanvas';
import { NodePalette } from './NodePalette';
import { WorkflowSettings } from './WorkflowSettings';
import { useWorkflow } from '../../contexts/WorkflowContext';
import { RoleBasedAccess } from '../auth/RoleBasedAccess';

export function WorkflowBuilder() {
  const [showSettings, setShowSettings] = useState(false);
  const [showPalette, setShowPalette] = useState(true);
  const { activeWorkflow, createWorkflow } = useWorkflow();

  const handleNewWorkflow = () => {
    const name = prompt('Enter workflow name:');
    if (name) {
      createWorkflow(name, 'New AI workflow');
    }
  };

  const nodeTypes = [
    { type: 'input', icon: MessageSquare, label: 'Input', color: 'bg-green-500', description: 'Collects user input and data' },
    { type: 'llm', icon: Zap, label: 'LLM', color: 'bg-blue-500', description: 'AI model processing and inference' },
    { type: 'tool', icon: Code, label: 'Tool', color: 'bg-purple-500', description: 'External tool integration' },
    { type: 'condition', icon: GitBranch, label: 'Condition', color: 'bg-orange-500', description: 'Conditional logic and branching' },
    { type: 'output', icon: Database, label: 'Output', color: 'bg-gray-500', description: 'Results output and storage' },
    { type: 'knowledge', icon: Database, label: 'Knowledge', color: 'bg-indigo-500', description: 'RAG document retrieval' },
    { type: 'agent', icon: Bot, label: 'Agent', color: 'bg-pink-500', description: 'Multi-step AI agent execution' },
    { type: 'debug', icon: Bug, label: 'Debug', color: 'bg-red-500', description: 'Workflow debugging and tracing' },
  ];

  return (
    <RoleBasedAccess module="workflow">
      <div className="h-full flex">
      {/* Node Palette */}
      {showPalette && (
        <div className="w-64 border-r border-gray-200 bg-gray-50">
          <NodePalette nodeTypes={nodeTypes} />
        </div>
      )}

      {/* Main Canvas Area */}
      <div className="flex-1 flex flex-col">
        {/* Workflow Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
          <div className="flex items-center space-x-3">
            <h2 className="text-lg font-semibold text-gray-900">
              {activeWorkflow ? activeWorkflow.name : 'joallm.ai Workflow Builder'}
            </h2>
            {!activeWorkflow && (
              <button
                onClick={handleNewWorkflow}
                className="flex items-center space-x-2 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>New Workflow</span>
              </button>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowPalette(!showPalette)}
              className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              {showPalette ? 'Hide' : 'Show'} Palette
            </button>
            
            <button className="flex items-center space-x-2 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors">
              <Play className="w-4 h-4" />
              <span>Run</span>
            </button>
            
            <button className="flex items-center space-x-2 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors">
              <Save className="w-4 h-4" />
              <span>Save</span>
            </button>
            
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-1.5 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 relative overflow-hidden">
          <WorkflowCanvas />
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="w-80 border-l border-gray-200 bg-white">
          <WorkflowSettings onClose={() => setShowSettings(false)} />
        </div>
      )}
      </div>
    </RoleBasedAccess>
  );
}