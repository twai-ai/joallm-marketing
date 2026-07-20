import React, { useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { useUserRole, UserRole } from '../../contexts/EnhancedUserRoleContext';

const roleOptions: Array<{ role: UserRole; label: string; description: string }> = [
  { role: 'developer', label: 'Developer', description: 'Full technical access' },
  { role: 'analyst', label: 'Data Analyst', description: 'Data-focused tools' },
  { role: 'business', label: 'Business User', description: 'Business workflows' },
  { role: 'casual', label: 'Casual User', description: 'Simple interface' },
];

export function UserRoleSelector() {
  const { role, setRole, getRoleConfig } = useUserRole();
  const [isOpen, setIsOpen] = useState(false);
  const currentConfig = getRoleConfig();

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-1.5 px-2 py-1 rounded-md hover:bg-gray-50 transition-colors"
      >
        <div className={`w-1.5 h-1.5 rounded-full ${currentConfig.color}`} />
        <span className="text-xs font-medium text-gray-600">{currentConfig.name}</span>
        <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1 w-56 bg-white shadow-lg border border-gray-200 rounded-lg overflow-hidden z-50">
          <div className="p-2 border-b border-gray-100 bg-gray-50">
            <h3 className="text-sm font-medium text-gray-900">Select Role</h3>
          </div>
          
          {roleOptions.map((option) => (
            <button
              key={option.role}
              onClick={() => {
                setRole(option.role);
                setIsOpen(false);
              }}
              className="w-full p-2.5 text-left hover:bg-gray-50 transition-colors flex items-center justify-between"
            >
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${
                  option.role === 'developer' ? 'bg-blue-500' :
                  option.role === 'analyst' ? 'bg-green-500' :
                  option.role === 'business' ? 'bg-purple-500' : 'bg-orange-500'
                }`} />
                <div>
                  <div className="text-sm font-medium text-gray-900">{option.label}</div>
                  <div className="text-xs text-gray-500">{option.description}</div>
                </div>
              </div>
              {role === option.role && (
                <Check className="w-3 h-3 text-blue-600" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}