import React, { useState } from 'react';
import { ChevronDown, Check, Lock, ArrowUp, Sparkles, Zap } from 'lucide-react';
import { useUserRole, UserRole, RoleUtils } from '../../contexts/EnhancedUserRoleContext';

interface EnhancedRoleSelectorProps {
  className?: string;
  showUpgradePaths?: boolean;
  compact?: boolean;
}

export function EnhancedRoleSelector({ 
  className = '', 
  showUpgradePaths = true,
  compact = false 
}: EnhancedRoleSelectorProps) {
  const { role, setRole, getRoleConfig, canUpgrade } = useUserRole();
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredRole, setHoveredRole] = useState<UserRole | null>(null);

  const currentConfig = getRoleConfig();
  const upgradeOptions = canUpgrade();
  const roleHierarchy = RoleUtils.getRoleHierarchy();

  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole);
    setIsOpen(false);
  };

  if (compact) {
    return (
      <div className={`relative ${className}`}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center space-x-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <span className="text-lg">{currentConfig.icon}</span>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {currentConfig.name}
          </span>
          <ChevronDown className="w-4 h-4 text-gray-500" />
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
            {roleHierarchy.map(({ role: roleKey, name }) => {
              const config = roleConfigs[roleKey];
              const isCurrent = roleKey === role;
              const isUpgrade = upgradeOptions.includes(roleKey);
              const isLocked = !isCurrent && !isUpgrade;

              return (
                <button
                  key={roleKey}
                  onClick={() => !isLocked && handleRoleChange(roleKey)}
                  disabled={isLocked}
                  className={`w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                    isCurrent ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  } ${isLocked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-xl">{config.icon}</span>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Level {config.accessLevel}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {isCurrent && <Check className="w-4 h-4 text-blue-600" />}
                    {isUpgrade && <ArrowUp className="w-4 h-4 text-green-600" />}
                    {isLocked && <Lock className="w-4 h-4 text-gray-400" />}
                  </div>
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
      {/* Current Role Display */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center shadow-lg">
              <span className="text-2xl">{currentConfig.icon}</span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {currentConfig.name}
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {currentConfig.description}
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500 dark:text-gray-400">Access Level</div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {currentConfig.accessLevel}
            </div>
          </div>
        </div>
      </div>

      {/* Role Selection */}
      <div>
        <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Switch Role
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {roleHierarchy.map(({ role: roleKey, name }) => {
            const config = roleConfigs[roleKey];
            const isCurrent = roleKey === role;
            const isUpgrade = upgradeOptions.includes(roleKey);
            const isLocked = !isCurrent && !isUpgrade;

            return (
              <div
                key={roleKey}
                className={`relative p-4 rounded-lg border-2 transition-all cursor-pointer ${
                  isCurrent
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : isUpgrade
                    ? 'border-green-300 bg-green-50 dark:bg-green-900/20 hover:border-green-400'
                    : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 opacity-60'
                }`}
                onClick={() => !isLocked && handleRoleChange(roleKey)}
                onMouseEnter={() => setHoveredRole(roleKey)}
                onMouseLeave={() => setHoveredRole(null)}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">{config.icon}</span>
                    <div>
                      <h5 className="font-semibold text-gray-900 dark:text-white">
                        {name}
                      </h5>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        Level {config.accessLevel}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {isCurrent && <Check className="w-5 h-5 text-blue-600" />}
                    {isUpgrade && <ArrowUp className="w-5 h-5 text-green-600" />}
                    {isLocked && <Lock className="w-5 h-5 text-gray-400" />}
                  </div>
                </div>

                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  {config.description}
                </p>

                {/* Features Preview */}
                <div className="space-y-2">
                  <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Key Features:
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {config.features.slice(0, 3).map((feature, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 text-xs bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full"
                      >
                        {feature}
                      </span>
                    ))}
                    {config.features.length > 3 && (
                      <span className="px-2 py-1 text-xs bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full">
                        +{config.features.length - 3} more
                      </span>
                    )}
                  </div>
                </div>

                {/* Upgrade Path Indicator */}
                {isUpgrade && (
                  <div className="mt-3 pt-3 border-t border-green-200 dark:border-green-800">
                    <div className="flex items-center text-green-600 dark:text-green-400">
                      <Sparkles className="w-4 h-4 mr-1" />
                      <span className="text-sm font-medium">Available Upgrade</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Upgrade Benefits */}
      {showUpgradePaths && upgradeOptions.length > 0 && (
        <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-xl p-6 border border-green-200 dark:border-green-800">
          <div className="flex items-center mb-4">
            <Zap className="w-6 h-6 text-green-600 dark:text-green-400 mr-2" />
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
              Unlock More Features
            </h4>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Upgrade your role to access advanced features and capabilities.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {upgradeOptions.map((upgradeRole) => {
              const config = roleConfigs[upgradeRole];
              return (
                <div key={upgradeRole} className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center space-x-3 mb-2">
                    <span className="text-xl">{config.icon}</span>
                    <h5 className="font-semibold text-gray-900 dark:text-white">
                      {config.name}
                    </h5>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    {config.description}
                  </p>
                  <button
                    onClick={() => handleRoleChange(upgradeRole)}
                    className="w-full flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <ArrowUp className="w-4 h-4 mr-2" />
                    Switch to {config.name}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Import roleConfigs for the component
import { roleConfigs } from '../../contexts/EnhancedUserRoleContext';
