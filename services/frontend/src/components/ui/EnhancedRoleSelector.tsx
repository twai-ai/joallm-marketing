import React, { useState } from 'react';
import { Check, ChevronDown, LayoutDashboard } from 'lucide-react';
import { RoleUtils, roleConfigs, useUserRole, type WorkspaceMode } from '../../contexts/EnhancedUserRoleContext';

interface EnhancedRoleSelectorProps {
  className?: string;
  showUpgradePaths?: boolean;
  compact?: boolean;
}

export function EnhancedRoleSelector({
  className = '',
  showUpgradePaths = true,
  compact = false,
}: EnhancedRoleSelectorProps) {
  const { workspaceMode, setWorkspaceMode, getRoleConfig, canUpgrade } = useUserRole();
  const [isOpen, setIsOpen] = useState(false);

  const currentConfig = getRoleConfig();
  const otherModes = canUpgrade();
  const modeHierarchy = RoleUtils.getRoleHierarchy();

  const handleModeChange = async (nextMode: WorkspaceMode) => {
    await setWorkspaceMode(nextMode);
    setIsOpen(false);
  };

  if (compact) {
    return (
      <div className={`relative ${className}`}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center space-x-2 rounded-lg border border-gray-300 bg-white px-3 py-2 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700"
        >
          <span className="text-lg">{currentConfig.icon}</span>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{currentConfig.name}</span>
          <ChevronDown className="h-4 w-4 text-gray-500" />
        </button>

        {isOpen && (
          <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
            {modeHierarchy.map(({ role }) => {
              const config = roleConfigs[role];
              const isCurrent = role === workspaceMode;

              return (
                <button
                  key={role}
                  onClick={() => void handleModeChange(role)}
                  className={`flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 ${
                    isCurrent ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-xl">{config.icon}</span>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">{config.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{config.description}</div>
                    </div>
                  </div>
                  {isCurrent ? <Check className="h-4 w-4 text-blue-600" /> : null}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-slate-50 p-6 dark:border-blue-800 dark:from-blue-900/20 dark:to-slate-900/20">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-lg dark:bg-gray-800">
              <span className="text-2xl">{currentConfig.icon}</span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{currentConfig.name}</h3>
              <p className="text-gray-600 dark:text-gray-400">{currentConfig.description}</p>
            </div>
          </div>
          <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-gray-600 shadow-sm dark:bg-gray-800 dark:text-gray-300">
            Workspace Mode
          </div>
        </div>
      </div>

      <div>
        <h4 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Switch Workspace Mode</h4>
        <div className="grid gap-4 md:grid-cols-3">
          {modeHierarchy.map(({ role }) => {
            const config = roleConfigs[role];
            const isCurrent = role === workspaceMode;

            return (
              <button
                key={role}
                onClick={() => void handleModeChange(role)}
                className={`rounded-lg border-2 p-4 text-left transition-all ${
                  isCurrent
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 bg-gray-50 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800'
                }`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">{config.icon}</span>
                    <h5 className="font-semibold text-gray-900 dark:text-white">{config.name}</h5>
                  </div>
                  {isCurrent ? <Check className="h-5 w-5 text-blue-600" /> : null}
                </div>

                <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">{config.description}</p>

                <div className="flex flex-wrap gap-1">
                  {config.features.slice(0, 3).map((feature) => (
                    <span
                      key={feature}
                      className="rounded-full bg-white px-2 py-1 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                    >
                      {feature}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {showUpgradePaths && otherModes.length > 0 ? (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-4 flex items-center">
            <LayoutDashboard className="mr-2 h-5 w-5 text-joa-primary" />
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Workspace Guidance</h4>
          </div>
          <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
            Workspace mode changes the emphasis and defaults in the UI. Account permissions and plan limits are still enforced separately by the backend.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {otherModes.map((mode) => {
              const config = roleConfigs[mode];
              return (
                <button
                  key={mode}
                  onClick={() => void handleModeChange(mode)}
                  className="rounded-lg border border-gray-200 bg-white p-4 text-left transition-colors hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900"
                >
                  <div className="mb-2 flex items-center space-x-3">
                    <span className="text-xl">{config.icon}</span>
                    <h5 className="font-semibold text-gray-900 dark:text-white">{config.name}</h5>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{config.description}</p>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
