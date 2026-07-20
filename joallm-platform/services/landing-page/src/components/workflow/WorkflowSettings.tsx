import React from 'react';
import { X, Save, Trash2 } from 'lucide-react';
import { useWorkflow } from '../../contexts/WorkflowContext';

interface WorkflowSettingsProps {
  onClose: () => void;
}

export function WorkflowSettings({ onClose }: WorkflowSettingsProps) {
  const { activeWorkflow, updateWorkflow, deleteWorkflow } = useWorkflow();

  if (!activeWorkflow) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <p className="text-gray-500">No workflow selected</p>
      </div>
    );
  }

  const handleSave = () => {
    // Save workflow settings
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this workflow?')) {
      deleteWorkflow(activeWorkflow.id);
      onClose();
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900">Workflow Settings</h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Basic Info */}
        <div>
          <h4 className="font-medium text-gray-900 mb-3">Basic Information</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                type="text"
                value={activeWorkflow.name}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={activeWorkflow.description}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>
        
        {/* Execution Settings */}
        <div>
          <h4 className="font-medium text-gray-900 mb-3">Execution Settings</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">
                Auto-save results
              </label>
              <input
                type="checkbox"
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">
                Parallel execution
              </label>
              <input
                type="checkbox"
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Timeout (seconds)
              </label>
              <input
                type="number"
                defaultValue={300}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>
        
        {/* Statistics */}
        <div>
          <h4 className="font-medium text-gray-900 mb-3">Statistics</h4>
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex justify-between">
              <span>Nodes:</span>
              <span>{activeWorkflow.nodes.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Connections:</span>
              <span>{activeWorkflow.edges.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Created:</span>
              <span>{activeWorkflow.created.toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Modified:</span>
              <span>{activeWorkflow.modified.toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Footer */}
      <div className="border-t border-gray-200 p-4 space-y-2">
        <button
          onClick={handleSave}
          className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
        >
          <Save className="w-4 h-4" />
          <span>Save Changes</span>
        </button>
        
        <button
          onClick={handleDelete}
          className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          <span>Delete Workflow</span>
        </button>
      </div>
    </div>
  );
}