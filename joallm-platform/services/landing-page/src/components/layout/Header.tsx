import { useState, useEffect, useRef } from 'react';
import { Menu, Settings, Search, User, LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { UserRoleSelector } from '../ui/UserRoleSelector';
import { EnhancedModelSelector } from '../models/EnhancedModelSelector';
import { ThemeToggle } from '../ui/ThemeToggle';
import { HeaderLogo } from '../ui/Logo';
import { useNavigate } from 'react-router-dom';

interface HeaderProps {
  onToggleSidebar: () => void;
  onOpenSettings: () => void;
  onOpenKnowledge?: () => void;
  currentView?: string;
}

export function Header({ onToggleSidebar, onOpenSettings }: HeaderProps) {
  const { user, logout, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <header className="bg-white border-b border-gray-100 h-14 flex items-center justify-between px-6">
      <div className="flex items-center space-x-4">
        {/* Hamburger Menu - Always Visible */}
        <button
          onClick={onToggleSidebar}
          className="p-1.5 rounded-md hover:bg-gray-50 transition-colors"
          title="Toggle menu"
        >
          <Menu className="w-5 h-5 text-gray-600" />
        </button>
        
            <HeaderLogo />
      </div>

      <div className="flex items-center space-x-3">
        {/* Model Selector - Only show when authenticated */}
        {isAuthenticated && <EnhancedModelSelector className="w-80" />}

        {/* Knowledge Base - Only show when authenticated */}
        {isAuthenticated && (
          <button
            onClick={() => navigate('/rag-search')}
            className="p-2 rounded-lg hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 dark:hover:from-blue-900/20 dark:hover:to-indigo-900/20 transition-all duration-200 group relative"
            title="Knowledge Base - Chat, Search & Manage Documents"
          >
            <Search className="w-4 h-4 text-blue-600 dark:text-blue-400 group-hover:text-blue-700" />
            <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
              Knowledge Base
            </div>
          </button>
        )}

        {/* Settings - Only show when authenticated */}
        {isAuthenticated && (
          <button
            onClick={onOpenSettings}
            className="p-1.5 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            title="Settings"
          >
            <Settings className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          </button>
        )}

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* Authentication Buttons - Show when not authenticated */}
        {!isAuthenticated && !isLoading && (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => navigate('/login')}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Sign In
            </button>
            <button
              onClick={() => navigate('/register')}
              className="px-4 py-2 text-sm font-medium text-white bg-joa-primary hover:bg-red-800 rounded-lg transition-colors"
            >
              Sign Up
            </button>
          </div>
        )}

        {/* User Menu - Only show when authenticated */}
        {isAuthenticated && user && (
          <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <User className="w-4 h-4 text-white" />
              )}
            </div>
            <div className="hidden md:block text-left">
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                {user?.name || 'User'}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {user?.role === 'casual' ? 'Casual User' : user?.role || 'Casual User'}
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          </button>

          {/* User Dropdown Menu */}
          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
              <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  {user?.name}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {user?.email}
                </div>
              </div>
              
              <div className="py-1">
                <button
                  onClick={() => {
                    onOpenSettings();
                    setShowUserMenu(false);
                  }}
                  className="w-full flex items-center px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </button>
                
                <button
                  onClick={async () => {
                    await logout();
                    setShowUserMenu(false);
                  }}
                  className="w-full flex items-center px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
        )}

        {/* User Role Selector - Only show when authenticated */}
        {isAuthenticated && <UserRoleSelector />}
      </div>
    </header>
  );
}