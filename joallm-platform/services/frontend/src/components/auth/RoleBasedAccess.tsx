import React from 'react';
import { Lock, Sparkles } from 'lucide-react';
import { useUserRole } from '../../contexts/EnhancedUserRoleContext';

interface RoleBasedAccessProps {
  children: React.ReactNode;
  module: string;
  fallback?: React.ReactNode;
  showUpgrade?: boolean;
}

const MODULE_LABELS: Record<string, string> = {
  workflow: 'Workflow',
  notebook: 'Notebook',
  'rag-search': 'Knowledge',
  chat: 'Chat',
  farm: 'Models',
  settings: 'Settings',
  admin: 'Admin',
};

export function RoleBasedAccess({
  children,
  module,
  fallback,
  showUpgrade = true,
}: RoleBasedAccessProps) {
  const { canAccess, getRoleConfig, backendRole, subscriptionTier, accessLoaded } = useUserRole();

  if (canAccess(module)) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  const workspaceConfig = getRoleConfig();
  const moduleLabel = MODULE_LABELS[module] ?? `${module.charAt(0).toUpperCase()}${module.slice(1)}`;
  const openUpgrade = () => {
    window.dispatchEvent(new CustomEvent('openUpgrade'));
  };

  return (
    <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-8 dark:border-gray-600 dark:bg-gray-800">
      <div className="max-w-lg text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700">
          <Lock className="h-8 w-8 text-gray-500 dark:text-gray-400" />
        </div>

        <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">{moduleLabel} Access Needed</h3>

        <p className="mb-3 text-gray-600 dark:text-gray-400">
          {moduleLabel} is available on JoaLLM Pro. Your current access is <span className="font-medium capitalize">{subscriptionTier}</span>, so this area is locked until you upgrade.
        </p>

        <div className="rounded-lg border border-gray-200 bg-white p-4 text-left dark:border-gray-700 dark:bg-gray-900">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Workspace Mode</p>
              <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">{workspaceConfig.name}</p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{workspaceConfig.description}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Account Access</p>
              <p className="mt-1 text-sm font-medium capitalize text-gray-900 dark:text-white">{backendRole}</p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 capitalize">
                {subscriptionTier} plan{accessLoaded ? '' : ' • loading current access snapshot'}
              </p>
            </div>
          </div>
        </div>

        {showUpgrade ? (
          <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/50 dark:bg-blue-950/30">
            <div className="mb-3 flex items-center justify-center text-blue-700 dark:text-blue-300">
              <Sparkles className="mr-2 h-5 w-5" />
              <h4 className="font-medium">Upgrade Recommended</h4>
            </div>
            <p className="text-sm text-blue-800 dark:text-blue-200">
              Upgrade to Pro to unlock {moduleLabel.toLowerCase()}, higher limits, and the full workspace toolset.
            </p>
            <button
              onClick={openUpgrade}
              className="mt-4 inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
            >
              Upgrade to Pro
            </button>
          </div>
        ) : null}

        <div className="mt-6 text-sm text-gray-500 dark:text-gray-400">
          <p>If you expected access already, check your current plan in Settings.</p>
        </div>
      </div>
    </div>
  );
}

export function DeveloperOnly({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  return (
    <RoleBasedAccess module="workflow" fallback={fallback}>
      {children}
    </RoleBasedAccess>
  );
}

export function AnalystOnly({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  return (
    <RoleBasedAccess module="notebook" fallback={fallback}>
      {children}
    </RoleBasedAccess>
  );
}

export function BusinessOnly({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  return (
    <RoleBasedAccess module="chat" fallback={fallback}>
      {children}
    </RoleBasedAccess>
  );
}
