import { useState, useEffect, useRef } from 'react';
import { Menu, Settings, User, LogOut, ChevronDown, Sparkles, BookOpen, MessageSquare, Search, Workflow, Bot } from 'lucide-react';
import { useUserRole } from '../../contexts/EnhancedUserRoleContext';
import { useAuth } from '../../contexts/AuthContext';
import { EnhancedModelSelector } from '../models/EnhancedModelSelector';
import { ThemeToggle } from '../ui/ThemeToggle';
import { CompactLogo, HeaderLogo } from '../ui/Logo';
import { useNavigate, useLocation } from 'react-router-dom';
import type { ViewMode } from '../../App';
import { PRODUCT_LABELS, PLATFORM_SHORT_NAME } from '../../constants/product';
import { USE_CASES } from '../../constants/useCases';
import { getProgramById } from '../../constants/programs';

interface HeaderProps {
  onToggleSidebar: () => void;
  onOpenSettings: () => void;
  onOpenKnowledge: () => void;
  currentView: ViewMode;
}

export function Header({ onToggleSidebar, onOpenSettings, currentView }: HeaderProps) {
  const { setWorkspaceMode, workspaceMode, canAccess, backendRole, subscriptionTier } = useUserRole();
  const { user, logout, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const displayName = user?.name?.trim() || user?.email?.split('@')[0] || 'User';

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
    const path = location.pathname;
    if (path.startsWith('/studio/campaigns/')) {
      const programId = path.split('/')[3];
      const match = programId ? getProgramById(programId) : undefined;
      if (match) return `${match.name} · Campaigns`;
      return 'Campaigns';
    }
    const studioMatch = USE_CASES.find(
      (workspace) => path === workspace.homeRoute || path.startsWith(`${workspace.homeRoute}/`),
    );
    if (studioMatch) return studioMatch.label;
    if (path === '/studio' || path.startsWith('/studio/custom')) return PRODUCT_LABELS.workflows;

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
      case 'welcome':
        return 'Welcome';
      default:
        return PLATFORM_SHORT_NAME;
    }
  };

  const workspaceOptions = [
    { value: 'enterprise', label: 'Enterprise Workspace', color: 'bg-slate-700' },
    { value: 'team', label: 'Team Workspace', color: 'bg-blue-500' },
    { value: 'personal', label: 'Personal Workspace', color: 'bg-orange-500' },
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
      isActive: currentView === 'workflow' || location.pathname.startsWith('/studio'),
    },
    {
      id: 'farm',
      label: PRODUCT_LABELS.models,
      icon: Bot,
      route: '/farm',
      isVisible: canAccess('farm'),
      isActive: currentView === 'farm',
    },
  ].filter((action) => action.isVisible);

  return (
    <header className="sticky top-0 z-40 shrink-0 px-3 pt-3 md:px-4">
      <div className="app-glass flex min-h-16 items-center justify-between gap-2 rounded-[28px] px-3 py-2 sm:px-4 md:px-6">
        <div className="flex min-w-0 flex-1 items-center space-x-2 sm:space-x-3 md:space-x-4">
          <button
            type="button"
            onClick={onToggleSidebar}
            className="rounded-xl p-2 transition-all duration-200 active:scale-95 hover:bg-white/70 lg:hidden"
            title="Toggle menu"
            aria-label="Toggle menu"
          >
            <Menu className="h-5 w-5 text-gray-600" />
          </button>

          <div className="flex-shrink-0">
            <div className="sm:hidden">
              <CompactLogo />
            </div>
            <div className="hidden sm:block">
              <HeaderLogo />
            </div>
          </div>

          {isAuthenticated && (
            <div className="app-chip hidden min-w-0 max-w-[14rem] truncate sm:flex xl:max-w-none">
              <Sparkles className="h-4 w-4 shrink-0 text-joa-primary" />
              <span className="truncate text-sm font-medium text-gray-700">{getViewTitle()}</span>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center space-x-1 sm:space-x-2 md:space-x-3">
          {isAuthenticated && (
            <div className="hidden md:block">
              <EnhancedModelSelector className="w-72 lg:w-80" />
            </div>
          )}

          {isAuthenticated && (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="hidden items-center gap-2 rounded-full border border-teal-100 bg-teal-50/90 px-3 py-2 text-sm shadow-sm xl:flex">
                <span className="text-gray-500">Signed in as</span>
                <span className="font-semibold text-joa-primary">{displayName}</span>
              </div>

              <div className="hidden items-center gap-1 rounded-2xl border border-slate-200 bg-white/75 px-1 py-1 lg:flex">
                {quickActions.map((action) => (
                  <button
                    key={action.id}
                    type="button"
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
                    <action.icon className="h-4 w-4" />
                    <span className="hidden xl:inline">{action.label}</span>
                  </button>
                ))}
              </div>

              <div className="flex items-center space-x-1 rounded-2xl border border-slate-200 bg-white/75 px-1 py-1">
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="rounded-xl p-2 transition-all duration-200 hover:bg-white"
                  title="Settings"
                  aria-label="Settings"
                >
                  <Settings className="h-5 w-5 text-gray-600" />
                </button>
                <ThemeToggle />
              </div>
            </div>
          )}

          {!isAuthenticated && <ThemeToggle />}

          {!isAuthenticated && !isLoading && (
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="rounded-xl px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-white/70 hover:text-gray-900"
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => navigate('/register')}
                className="rounded-lg bg-joa-primary px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-teal-800 hover:shadow-md active:scale-95"
              >
                Sign Up
              </button>
            </div>
          )}

          {isAuthenticated && user && (
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center space-x-2 rounded-2xl border border-transparent px-2 py-2 transition-all duration-200 hover:border-slate-200 hover:bg-white/70 sm:px-3"
                aria-label="User menu"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-slate-900 ring-2 ring-white">
                  {user.avatar ? (
                    <img src={user.avatar} alt={displayName} className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <User className="h-4 w-4 text-white" />
                  )}
                </div>

                <div className="hidden items-center space-x-2 md:flex">
                  <div className="text-left">
                    <div className="text-sm font-semibold leading-tight text-joa-primary">{displayName}</div>
                    <div className="flex items-center space-x-1 text-xs text-gray-500">
                      <div className={`h-1.5 w-1.5 rounded-full ${currentWorkspace.color}`} />
                      <span>{currentWorkspace.label}</span>
                    </div>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${showUserMenu ? 'rotate-180' : ''}`}
                  />
                </div>
              </button>

              {showUserMenu && (
                <div className="absolute right-0 z-50 mt-2 w-64 animate-in fade-in slide-in-from-top-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl duration-200">
                  <div className="border-b border-gray-200 bg-gradient-to-br from-gray-50 to-white p-4">
                    <div className="flex items-center space-x-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 ring-2 ring-white">
                        {user.avatar ? (
                          <img src={user.avatar} alt={displayName} className="h-12 w-12 rounded-full object-cover" />
                        ) : (
                          <User className="h-6 w-6 text-white" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-joa-primary">{displayName}</div>
                        <div className="truncate text-xs text-gray-500">{user.email}</div>
                      </div>
                    </div>
                  </div>

                  <div className="border-b border-gray-200 p-2">
                    <div className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Workspace Mode
                    </div>
                    {workspaceOptions.map((workspaceOption) => (
                      <button
                        key={workspaceOption.value}
                        type="button"
                        onClick={() => {
                          void setWorkspaceMode(workspaceOption.value as 'enterprise' | 'team' | 'personal');
                        }}
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 transition-all duration-200 ${
                          workspaceMode === workspaceOption.value
                            ? 'bg-joa-primary/10 text-joa-primary'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5">
                          <div className={`h-2 w-2 rounded-full ${workspaceOption.color}`} />
                          <span className="text-sm font-medium">{workspaceOption.label}</span>
                        </div>
                      </button>
                    ))}
                    <div className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
                      Account: <span className="font-medium capitalize">{backendRole}</span> · Plan:{' '}
                      <span className="font-medium capitalize">{subscriptionTier}</span>
                    </div>
                  </div>

                  <div className="py-1">
                    <button
                      type="button"
                      onClick={() => {
                        onOpenSettings();
                        setShowUserMenu(false);
                      }}
                      className="flex w-full items-center space-x-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <Settings className="h-4 w-4" />
                      <span>Settings</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('/docs')}
                      className="flex w-full items-center space-x-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <BookOpen className="h-4 w-4" />
                      <span>Documentation</span>
                    </button>
                    <div className="my-1 border-t border-gray-200" />
                    <button
                      type="button"
                      onClick={async () => {
                        await logout();
                        setShowUserMenu(false);
                      }}
                      className="flex w-full items-center space-x-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                    >
                      <LogOut className="h-4 w-4" />
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
