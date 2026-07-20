import React from 'react';
import { X, Trash2 } from 'lucide-react';
import { useWorkflow } from '../../contexts/WorkflowContext';
import { workspaceButton, workspaceInput, workspaceSectionLabel, workspaceTextarea } from '../workspace/workspaceTheme';

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

  const updateActiveWorkflow = (patch: Partial<typeof activeWorkflow>) => {
    updateWorkflow({ ...activeWorkflow, ...patch });
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this workflow?')) {
      deleteWorkflow(activeWorkflow.id);
      onClose();
    }
  };

  return (
    <div className="h-full flex flex-col bg-white/85 backdrop-blur-xl">
      {/* Header */}
      <div className="border-b border-slate-200/80 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className={workspaceSectionLabel}>Workflow metadata</p>
            <h3 className="mt-1 font-semibold text-slate-900">Workflow Settings</h3>
          </div>
        
        <button
          onClick={onClose}
          className="rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
        >
          <X className="w-5 h-5" />
        </button>
        </div>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Basic Info */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
          <h4 className="mb-3 font-medium text-slate-900">Basic Information</h4>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Name
              </label>
              <input
                type="text"
                value={activeWorkflow.name}
                onChange={(e) => updateActiveWorkflow({ name: e.target.value })}
                className={workspaceInput}
              />
            </div>
            
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Description
              </label>
              <textarea
                value={activeWorkflow.description}
                onChange={(e) => updateActiveWorkflow({ description: e.target.value })}
                rows={3}
                className={workspaceTextarea}
              />
            </div>
          </div>
        </div>
        
        {/* Execution Settings */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
          <h4 className="mb-3 font-medium text-slate-900">Execution Settings</h4>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
            The current executor uses backend defaults for execution behavior. Node-level logic is configured on the canvas;
            workflow-level execution toggles are not exposed yet.
          </div>
        </div>
        
        {/* Statistics */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
          <h4 className="mb-3 font-medium text-slate-900">Statistics</h4>
          <div className="space-y-2 text-sm text-slate-600">
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
      <div className="space-y-2 border-t border-slate-200/80 p-4">
        <button
          onClick={onClose}
          className={`${workspaceButton.accent} w-full`}
        >
          <span>Done</span>
        </button>
        
        <button
          onClick={handleDelete}
          className={`${workspaceButton.danger} w-full`}
        >
          <Trash2 className="w-4 h-4" />
          <span>Delete Workflow</span>
        </button>
      </div>
    </div>
  );
}
