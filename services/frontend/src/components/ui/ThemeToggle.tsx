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
        className="p-2 rounded-md hover:bg-white dark:hover:bg-gray-700 transition-all duration-200 group relative"
        title={`Theme: ${currentOption?.label} (${effectiveTheme === 'dark' ? 'Dark' : 'Light'})`}
        aria-label={`Switch theme. Current: ${currentOption?.label}`}
      >
        {CurrentIcon && <CurrentIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />}
        <div className="absolute -bottom-10 left-1/2 transform -translate-x-1/2 bg-gray-900 dark:bg-gray-700 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
          Theme
        </div>
      </button>

      {/* Theme options dropdown - only show when isOpen is true */}
      {isOpen && (
        <>
          {/* Backdrop for mobile */}
          <div className="fixed inset-0 z-40 md:hidden" onClick={() => setIsOpen(false)} />
          
          <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 py-1 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
            {themeOptions.map((option) => {
              const Icon = option.icon;
              const isActive = theme === option.value;
              const isEffectiveDark = effectiveTheme === 'dark';

              return (
                <button
                  key={option.value}
                  onClick={() => handleThemeSelect(option.value)}
                  className={`w-full flex items-center space-x-3 px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 first:rounded-t-xl last:rounded-b-xl ${
                    isActive ? 'bg-joa-primary/10 dark:bg-joa-primary/20 text-joa-primary' : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-joa-primary' : 'text-gray-400 dark:text-gray-500'}`} />
                  <span className="flex-1 text-sm font-medium">{option.label}</span>
                  {isActive && (
                    <div className="w-1.5 h-1.5 rounded-full bg-joa-primary animate-pulse" />
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


