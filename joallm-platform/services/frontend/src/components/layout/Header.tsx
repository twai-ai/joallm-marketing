import React, { useState, useEffect, useRef } from 'react';
import { Menu, Settings, User, LogOut, ChevronDown, Sparkles, BookOpen, MessageSquare, Search, Workflow, Bot } from 'lucide-react';
import { useUserRole } from '../../contexts/EnhancedUserRoleContext';
import { useAuth } from '../../contexts/AuthContext';
import { EnhancedModelSelector } from '../models/EnhancedModelSelector';
import { ThemeToggle } from '../ui/ThemeToggle';
import { CompactLogo, HeaderLogo } from '../ui/Logo';
import { useNavigate } from 'react-router-dom';
import type { ViewMode } from '../../App';
import { PRODUCT_LABELS } from '../../constants/product';

interface HeaderProps {
  onToggleSidebar: () => void;
  onOpenSettings: () => void;
  onOpenKnowledge: () => void;
  currentView: ViewMode;
}

export function Header({ onToggleSidebar, onOpenSettings, onOpenKnowledge, currentView }: HeaderProps) {
  const { getRoleConfig, setWorkspaceMode, workspaceMode, canAccess, backendRole, subscriptionTier } = useUserRole();
  const { user, logout, isAuthenticated, isLoading } = useAuth();
  const roleConfig = getRoleConfig();
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const displayName = user?.name?.trim() || user?.email?.split('@')[0] || 'User';

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

  const getViewTitle = () => {
    switch (currentView) {
      case 'chat':
        return PRODUCT_LABELS.chat;
      case 'rag-search':
        return PRODUCT_LABELS.knowledge;
      case 'notebook':
        return PRODUCT_LABELS.notebooks;
      case 'workflow':
        return PRODUCT_LABELS.workflows;
      case 'farm':
        return PRODUCT_LABELS.models;
      case 'docs':
        return PRODUCT_LABELS.documentation;
      default:
        return 'Platform';
    }
  };

  const workspaceOptions = [
    { value: 'enterprise', label: 'Enterprise Workspace', icon: '🏢', color: 'bg-slate-700' },
    { value: 'team', label: 'Team Workspace', icon: '🤝', color: 'bg-blue-500' },
    { value: 'personal', label: 'Personal Workspace', icon: '💬', color: 'bg-orange-500' },
  ];

  const currentWorkspace = workspaceOptions.find((option) => option.value === workspaceMode) || workspaceOptions[2];

  const quickActions = [
    {
      id: 'chat',
      label: PRODUCT_LABELS.chat,
      icon: MessageSquare,
      route: '/chat',
      isVisible: canAccess('chat'),
      isActive: currentView === 'chat',
    },
    {
      id: 'rag-search',
      label: PRODUCT_LABELS.knowledge,
      icon: Search,
      route: '/rag-search',
      isVisible: canAccess('rag-search'),
      isActive: currentView === 'rag-search',
    },
    {
      id: 'notebook',
      label: PRODUCT_LABELS.notebooks,
      icon: BookOpen,
      route: '/notebook',
      isVisible: canAccess('notebook'),
      isActive: currentView === 'notebook',
    },
    {
      id: 'workflow',
      label: PRODUCT_LABELS.workflows,
      icon: Workflow,
      route: '/studio',
      isVisible: canAccess('workflow'),
      isActive: currentView === 'workflow',
    },
    {
      id: 'farm',
      label: PRODUCT_LABELS.models,
      icon: Bot,
      route: '/farm',
      isVisible: canAccess('farm'),
      isActive: currentView === 'farm',
    },
  ].filter(action => action.isVisible);

  return (
    <header className="sticky top-0 z-40 px-3 pt-3 md:px-4">
      {/* Left Section: Menu + Logo + Current View */}
      <div className="app-glass flex min-h-16 items-center justify-between gap-2 rounded-[28px] px-3 py-2 sm:px-4 md:px-6">
      <div className="flex min-w-0 flex-1 items-center space-x-2 sm:space-x-3 md:space-x-4">
        {/* Hamburger Menu */}
        <button
          onClick={onToggleSidebar}
          className="rounded-xl p-2 transition-all duration-200 active:scale-95 hover:bg-white/70"
          title="Toggle menu"
          aria-label="Toggle menu"
        >
          <Menu className="w-5 h-5 text-gray-600" />
        </button>
        
        {/* Logo */}
        <div className="flex-shrink-0">
          <div className="sm:hidden">
            <CompactLogo />
          </div>
          <div className="hidden sm:block">
            <HeaderLogo />
          </div>
        </div>

        {/* Current View Indicator - Hidden on small screens */}
        {isAuthenticated && (
          <div className="app-chip hidden xl:flex">
            <Sparkles className="w-4 h-4 text-joa-primary" />
            <span className="text-sm font-medium text-gray-700">
              {getViewTitle()}
            </span>
          </div>
        )}
      </div>

      {/* Right Section: Model Selector + Actions + User Menu */}
      <div className="flex shrink-0 items-center space-x-1 sm:space-x-2 md:space-x-3">
        {/* Model Selector - Only show when authenticated */}
        {isAuthenticated && (
          <div className="hidden md:block">
            <EnhancedModelSelector className="w-72 lg:w-80" />
          </div>
        )}

        {/* Quick Actions Group - Only show when authenticated */}
        {isAuthenticated && (
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="hidden xl:flex items-center gap-2 rounded-full border border-teal-100 bg-teal-50/90 px-3 py-2 text-sm shadow-sm">
              <span className="text-gray-500">Signed in as</span>
              <span className="font-semibold text-joa-primary">{displayName}</span>
            </div>

            <div className="hidden lg:flex items-center gap-1 rounded-2xl border border-slate-200 bg-white/75 px-1 py-1">
              {quickActions.map((action) => (
                <button
                  key={action.id}
                  onClick={() => navigate(action.route)}
                  className={`group relative flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-all duration-200 ${
                    action.isActive
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:bg-white hover:text-gray-900'
                  }`}
                  title={action.label}
                  aria-label={action.label}
                  aria-current={action.isActive ? 'page' : undefined}
                >
                  <action.icon className="w-4 h-4" />
                  <span className="hidden xl:inline">{action.label}</span>
                  <div className="absolute -bottom-10 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 transition-opacity pointer-events-none group-hover:opacity-100 xl:hidden">
                    {action.label}
                  </div>
                </button>
              ))}
            </div>

            <div className="flex items-center space-x-1 rounded-2xl border border-slate-200 bg-white/75 px-1 py-1">
              <button
                onClick={onOpenSettings}
                className="group relative rounded-xl p-2 transition-all duration-200 hover:bg-white"
                title="Settings"
                aria-label="Settings"
              >
                <Settings className="w-5 h-5 text-gray-600" />
                <div className="absolute -bottom-10 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                  Settings
                </div>
              </button>

              <ThemeToggle />
            </div>
          </div>
        )}

        {/* Theme Toggle for non-authenticated users */}
        {!isAuthenticated && <ThemeToggle />}

        {/* Authentication Buttons - Show when not authenticated */}
        {!isAuthenticated && !isLoading && (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => navigate('/login')}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors rounded-xl hover:bg-white/70"
            >
              Sign In
            </button>
            <button
              onClick={() => navigate('/register')}
              className="px-4 py-2 text-sm font-medium text-white bg-joa-primary hover:bg-teal-800 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md active:scale-95"
            >
              Sign Up
            </button>
          </div>
        )}

        {/* Unified User Menu - Only show when authenticated */}
        {isAuthenticated && user && (
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center space-x-2 rounded-2xl border border-transparent px-2 py-2 transition-all duration-200 hover:border-slate-200 hover:bg-white/70 sm:px-3"
              aria-label="User menu"
            >
              {/* User Avatar */}
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-slate-900 rounded-full flex items-center justify-center ring-2 ring-white">
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt={displayName}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <User className="w-4 h-4 text-white" />
                )}
              </div>
              
              {/* User Info - Hidden on small screens */}
              <div className="hidden md:flex items-center space-x-2">
                <div className="text-left">
                  <div className="text-sm font-semibold text-joa-primary leading-tight">
                    {displayName}
                  </div>
                  <div className="flex items-center space-x-1 text-xs text-gray-500">
                    <div className={`w-1.5 h-1.5 rounded-full ${currentWorkspace.color}`} />
                    <span>{currentWorkspace.label}</span>
                  </div>
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${showUserMenu ? 'rotate-180' : ''}`} />
              </div>
            </button>

            {/* Enhanced User Dropdown Menu */}
            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-64 rounded-2xl shadow-xl border border-slate-200 bg-white overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                {/* User Info Header */}
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-900">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center ring-2 ring-white dark:ring-gray-800">
                      {user.avatar ? (
                        <img
                          src={user.avatar}
                          alt={displayName}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <User className="w-6 h-6 text-white" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-joa-primary truncate">
                        {displayName}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {user.email}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Workspace Mode Selection */}
                <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                  <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Workspace Mode
                  </div>
                  <div className="px-3 pb-2 text-xs text-gray-500 dark:text-gray-400">
                    Changes UI defaults and emphasis. Backend role and plan still control actual access.
                  </div>
                  {workspaceOptions.map((workspaceOption) => (
                    <button
                      key={workspaceOption.value}
                      onClick={() => {
                        void setWorkspaceMode(workspaceOption.value as any);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-200 ${
                        workspaceMode === workspaceOption.value
                          ? 'bg-joa-primary/10 text-joa-primary dark:bg-joa-primary/20'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5">
                        <div className={`w-2 h-2 rounded-full ${workspaceOption.color}`} />
                        <span className="text-sm font-medium">{workspaceOption.label}</span>
                      </div>
                      {workspaceMode === workspaceOption.value && (
                        <div className="w-1.5 h-1.5 rounded-full bg-joa-primary animate-pulse" />
                      )}
                    </button>
                  ))}
                  <div className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:bg-gray-700/60 dark:text-gray-300">
                    Account access: <span className="font-medium capitalize">{backendRole}</span> • Plan: <span className="font-medium capitalize">{subscriptionTier}</span>
                  </div>
                </div>
                
                {/* Menu Actions */}
                <div className="py-1">
                  <button
                    onClick={() => {
                      onOpenSettings();
                      setShowUserMenu(false);
                    }}
                    className="w-full flex items-center space-x-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                    <span>Settings</span>
                  </button>
                  
                  <button
                    onClick={() => navigate('/docs')}
                    className="w-full flex items-center space-x-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>Documentation</span>
                  </button>
                  
                  <div className="my-1 border-t border-gray-200 dark:border-gray-700" />
                  
                  <button
                    onClick={async () => {
                      await logout();
                      setShowUserMenu(false);
                    }}
                    className="w-full flex items-center space-x-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      </div>
    </header>
  );
}
