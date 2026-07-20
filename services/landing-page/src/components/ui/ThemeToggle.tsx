import React, { useState, useEffect, useRef } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

export function ThemeToggle() {
  const { theme, effectiveTheme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const themeOptions = [
    { value: 'light', icon: Sun, label: 'Light' },
    { value: 'dark', icon: Moon, label: 'Dark' },
    { value: 'system', icon: Monitor, label: 'System' },
  ];

  const currentOption = themeOptions.find(option => option.value === theme);
  const CurrentIcon = currentOption?.icon;

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleThemeSelect = (value: string) => {
    setTheme(value as any);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        title={`Theme: ${currentOption?.label} (${effectiveTheme === 'dark' ? 'Dark' : 'Light'})`}
        aria-label={`Switch theme. Current: ${currentOption?.label}`}
      >
        {CurrentIcon && <CurrentIcon className="w-4 h-4 text-gray-600 dark:text-gray-300" />}
      </button>

      {/* Theme options dropdown - only show when isOpen is true */}
      {isOpen && (
        <>
          {/* Backdrop for mobile */}
          <div className="fixed inset-0 z-40 md:hidden" onClick={() => setIsOpen(false)} />
          
          <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
            {themeOptions.map((option) => {
              const Icon = option.icon;
              const isActive = theme === option.value;
              const isEffectiveDark = effectiveTheme === 'dark';

              return (
                <button
                  key={option.value}
                  onClick={() => handleThemeSelect(option.value)}
                  className={`w-full flex items-center space-x-3 px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                    isActive ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300' : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-red-500 dark:text-red-400' : 'text-gray-400 dark:text-gray-500'}`} />
                  <span className="flex-1 text-sm font-medium">{option.label}</span>
                  {isActive && (
                    <div className={`w-2 h-2 rounded-full ${isEffectiveDark ? 'bg-red-500' : 'bg-red-400'}`} />
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}


