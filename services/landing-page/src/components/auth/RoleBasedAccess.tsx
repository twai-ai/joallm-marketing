import React from 'react';
import { useUserRole } from '../../contexts/EnhancedUserRoleContext';
import { Lock, ArrowUp, Sparkles } from 'lucide-react';

interface RoleBasedAccessProps {
  children: React.ReactNode;
  module: string;
  fallback?: React.ReactNode;
  showUpgrade?: boolean;
}

export function RoleBasedAccess({ 
  children, 
  module, 
  fallback, 
  showUpgrade = true 
}: RoleBasedAccessProps) {
  const { canAccess, role, getRoleConfig, canUpgrade } = useUserRole();

  if (canAccess(module)) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  const roleConfig = getRoleConfig();
  const upgradeOptions = canUpgrade();

  return (
    <div className="flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
          <Lock className="w-8 h-8 text-gray-500 dark:text-gray-400" />
        </div>
        
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          {module.charAt(0).toUpperCase() + module.slice(1)} Access Required
        </h3>
        
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          This feature is available in higher access levels. Your current role ({roleConfig.name}) 
          doesn't include access to {module}.
        </p>

        {showUpgrade && upgradeOptions.length > 0 && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
              <div className="flex items-center mb-3">
                <Sparkles className="w-5 h-5 text-blue-500 mr-2" />
                <h4 className="font-medium text-gray-900 dark:text-white">Upgrade Options</h4>
              </div>
              
              <div className="space-y-2">
                {upgradeOptions.map((upgradeRole) => {
                  const upgradeConfig = roleConfigs[upgradeRole];
                  return (
                    <div key={upgradeRole} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-600 rounded-lg">
                      <div className="flex items-center">
                        <span className="text-2xl mr-3">{upgradeConfig.icon}</span>
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">
                            {upgradeConfig.name}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {upgradeConfig.description}
                          </div>
                        </div>
                      </div>
                      <button className="flex items-center px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                        <ArrowUp className="w-4 h-4 mr-1" />
                        Upgrade
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 text-sm text-gray-500 dark:text-gray-400">
          <p>Need help? Contact your administrator or check our documentation.</p>
        </div>
      </div>
    </div>
  );
}

// Convenience components for common modules
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

// Import roleConfigs for the component
import { roleConfigs } from '../../contexts/EnhancedUserRoleContext';
