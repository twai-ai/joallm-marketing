import React, { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { roleConfigs, useUserRole, type WorkspaceMode } from '../../contexts/EnhancedUserRoleContext';

const workspaceOptions: Array<{ role: WorkspaceMode; label: string; description: string }> = [
  { role: 'personal', label: 'Personal Workspace', description: 'Focused individual work' },
  { role: 'team', label: 'Team Workspace', description: 'Shared knowledge and repeatable work' },
  { role: 'enterprise', label: 'Enterprise Workspace', description: 'Governed, operational workspace' },
];

export function UserRoleSelector() {
  const { workspaceMode, setWorkspaceMode, getRoleConfig } = useUserRole();
  const [isOpen, setIsOpen] = useState(false);
  const currentConfig = getRoleConfig();

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-1.5 rounded-md px-2 py-1 transition-colors hover:bg-gray-50"
      >
        <div className={`h-1.5 w-1.5 rounded-full ${currentConfig.color}`} />
        <span className="text-xs font-medium text-gray-600">{currentConfig.name}</span>
        <ChevronDown className={`h-3 w-3 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-1 w-64 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
          <div className="border-b border-gray-100 bg-gray-50 p-2">
            <h3 className="text-sm font-medium text-gray-900">Choose Workspace Mode</h3>
          </div>

          {workspaceOptions.map((option) => (
            <button
              key={option.role}
              onClick={() => {
                void setWorkspaceMode(option.role);
                setIsOpen(false);
              }}
              className="flex w-full items-center justify-between p-2.5 text-left transition-colors hover:bg-gray-50"
            >
              <div className="flex items-center space-x-2">
                <div className={`h-2 w-2 rounded-full ${roleConfigs[option.role].color}`} />
                <div>
                  <div className="text-sm font-medium text-gray-900">{option.label}</div>
                  <div className="text-xs text-gray-500">{option.description}</div>
                </div>
              </div>
              {workspaceMode === option.role ? <Check className="h-3 w-3 text-blue-600" /> : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
