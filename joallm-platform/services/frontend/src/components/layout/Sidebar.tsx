import React, { useEffect, useMemo, useState } from 'react';
import {
  Book,
  BookOpen,
  Bookmark,
  Database,
  FileText,
  History,
  Home,
  LayoutDashboard,
  MessageSquare,
  Radio,
  Search,
  Settings,
  Sparkles,
  Users,
  Workflow,
  X,
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUserRole } from '../../contexts/EnhancedUserRoleContext';
import { SidebarLogo } from '../ui/Logo';
import type { ViewMode } from '../../App';
import { apiClient } from '../../utils/api-client';
import { showError } from '../../utils/toast';
import { PRODUCT_DESCRIPTIONS, PRODUCT_LABELS } from '../../constants/product';
import { USE_CASES, type UseCaseDefinition } from '../../constants/useCases';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  onQuickPrompt?: (prompt: string) => void;
  onOpenKnowledge?: () => void;
  onOpenSettings?: () => void;
  onOpenBookmarks?: () => void;
}

type NavItem = {
  id: ViewMode;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  status: 'live' | 'soon';
};

const STUDIO_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  media: Sparkles,
  acquisition: Users,
  'docs-ai': FileText,
  'data-intelligence': Database,
  'marketing-studio': Radio,
};

function StatusPill({ status }: { status: 'live' | 'soon' }) {
  if (status === 'live') {
    return (
      <span className="inline-flex items-center rounded-full bg-teal-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-200 ring-1 ring-teal-400/30">
        Live
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-slate-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-300 ring-1 ring-white/10">
      Soon
    </span>
  );
}

export function Sidebar({
  isOpen,
  onToggle,
  currentView,
  onViewChange,
  onOpenSettings,
  onOpenBookmarks,
}: SidebarProps) {
  const { getRoleConfig } = useUserRole();
  const roleConfig = getRoleConfig();
  const navigate = useNavigate();
  const location = useLocation();
  const [isDesktop, setIsDesktop] = useState(false);
  const [showRecentChats, setShowRecentChats] = useState(false);
  const [recentChats, setRecentChats] = useState<any[]>([]);
  const [loadingChats, setLoadingChats] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const sync = () => setIsDesktop(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (showRecentChats && recentChats.length === 0) {
      void fetchRecentChats();
    }
  }, [showRecentChats, recentChats.length]);

  const fetchRecentChats = async () => {
    setLoadingChats(true);
    try {
      const response = await apiClient.get<{ sessions?: any[] }>('/api/chat/sessions?limit=10');
      setRecentChats(response.sessions || []);
    } catch (error) {
      console.error('Failed to fetch recent chats:', error);
      showError('Failed to load recent chats');
    } finally {
      setLoadingChats(false);
    }
  };

  const closeIfMobile = () => {
    if (!isDesktop) onToggle();
  };

  const handleNavigate = (view: ViewMode) => {
    onViewChange(view);
    closeIfMobile();
  };

  const handleStudioNav = (workspace: UseCaseDefinition) => {
    if (workspace.status !== 'active') return;
    navigate(workspace.homeRoute);
    closeIfMobile();
  };

  const coreNavigation = useMemo<NavItem[]>(
    () => [
      {
        id: 'welcome',
        icon: Home,
        label: 'Welcome',
        description: 'Platform overview',
        status: 'live',
      },
      {
        id: 'chat',
        icon: MessageSquare,
        label: PRODUCT_LABELS.chat,
        description: PRODUCT_DESCRIPTIONS.chat,
        status: 'live',
      },
      {
        id: 'rag-search',
        icon: Search,
        label: PRODUCT_LABELS.knowledge,
        description: PRODUCT_DESCRIPTIONS.knowledge,
        status: 'live',
      },
      {
        id: 'workflow',
        icon: LayoutDashboard,
        label: 'Studio overview',
        description: 'Directory of guided workspaces',
        status: 'live',
      },
      {
        id: 'notebook',
        icon: BookOpen,
        label: PRODUCT_LABELS.notebooks,
        description: PRODUCT_DESCRIPTIONS.notebooks,
        status: 'live',
      },
      {
        id: 'farm',
        icon: Database,
        label: PRODUCT_LABELS.models,
        description: PRODUCT_DESCRIPTIONS.models,
        status: 'live',
      },
    ],
    [],
  );

  const studioWorkspaces = USE_CASES;

  const utilities = useMemo(
    () => [
      {
        label: 'Recent Chats',
        icon: History,
        action: () => setShowRecentChats(true),
      },
      {
        label: 'Saved Items',
        icon: Bookmark,
        action: () => {
          if (onOpenBookmarks) {
            onOpenBookmarks();
            closeIfMobile();
          }
        },
      },
      {
        label: 'Settings',
        icon: Settings,
        action: () => {
          if (onOpenSettings) {
            onOpenSettings();
            closeIfMobile();
          }
        },
      },
      {
        label: PRODUCT_LABELS.documentation,
        icon: Book,
        action: () => handleNavigate('docs'),
      },
    ],
    [onOpenBookmarks, onOpenSettings, isDesktop],
  );

  const visible = isDesktop || isOpen;
  if (!visible) {
    return null;
  }

  return (
    <>
      {!isDesktop && (
        <div
          className="fixed inset-0 z-40 bg-black/50 animate-in fade-in duration-200"
          onClick={onToggle}
        />
      )}

      <aside
        className={`app-sidebar-shell z-50 flex w-[min(20rem,calc(100vw-1rem))] max-w-full flex-col shadow-xl lg:m-3 lg:mr-0 lg:w-80 lg:shrink-0 lg:rounded-[28px] lg:border lg:border-white/10 ${
          isDesktop
            ? 'relative h-[calc(100dvh-1.5rem)]'
            : 'fixed inset-y-0 left-0 animate-in slide-in-from-left duration-300'
        }`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 p-4">
          <SidebarLogo />
          {!isDesktop && (
            <button
              onClick={onToggle}
              className="rounded-xl p-2 transition-colors hover:bg-white/10"
              title="Close sidebar"
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          <section className="border-b border-white/10 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Core</p>
              <span className="text-[10px] uppercase tracking-wide text-slate-500">Platform</span>
            </div>
            <div className="mt-3 space-y-2">
              {coreNavigation.map((item) => {
                const isActive =
                  currentView === item.id ||
                  (item.id === 'workflow' && location.pathname.startsWith('/studio') && location.pathname === '/studio');

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavigate(item.id)}
                    className={`w-full rounded-xl border p-3 text-left transition-colors ${
                      isActive
                        ? 'border-white/20 bg-white/12 shadow-[0_12px_24px_rgba(15,23,42,0.14)]'
                        : 'border-white/8 bg-white/4 hover:border-white/14 hover:bg-white/8'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                          isActive ? 'bg-white text-joa-primary' : 'bg-white/10 text-white'
                        }`}
                      >
                        <item.icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-medium text-white">{item.label}</div>
                          <StatusPill status={item.status} />
                        </div>
                        <p className={`mt-1 text-xs ${isActive ? 'text-white/80' : 'text-slate-400'}`}>
                          {item.description}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="border-b border-white/10 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Studio</p>
              <span className="text-[10px] uppercase tracking-wide text-slate-500">
                {studioWorkspaces.filter((w) => w.status === 'active').length} live
              </span>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-400">
              Live workspaces are ready to use. Soon items are reserved and not clickable yet.
            </p>
            <div className="mt-3 space-y-2">
              {studioWorkspaces.map((workspace) => {
                const Icon = STUDIO_ICONS[workspace.id] || Workflow;
                const isLive = workspace.status === 'active';
                const isActive = isLive && location.pathname.startsWith(workspace.homeRoute);

                return (
                  <button
                    key={workspace.id}
                    type="button"
                    disabled={!isLive}
                    onClick={() => handleStudioNav(workspace)}
                    className={`w-full rounded-xl border p-3 text-left transition-colors ${
                      !isLive
                        ? 'cursor-not-allowed border-white/5 bg-white/[0.02] opacity-55'
                        : isActive
                          ? 'border-teal-400/40 bg-teal-500/15'
                          : 'border-white/8 bg-white/4 hover:border-teal-400/30 hover:bg-white/8'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                          isActive ? 'bg-teal-400 text-slate-950' : 'bg-white/10 text-white'
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-medium text-white">{workspace.label}</div>
                          <StatusPill status={isLive ? 'live' : 'soon'} />
                        </div>
                        <p className="mt-1 text-xs text-slate-400 line-clamp-2">{workspace.description}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Utilities</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {utilities.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.action}
                  className="rounded-xl border border-white/8 bg-white/4 p-3 text-left transition-colors hover:border-white/14 hover:bg-white/8"
                >
                  <item.icon className="h-4 w-4 text-white" />
                  <p className="mt-2 text-sm text-white">{item.label}</p>
                </button>
              ))}
            </div>
          </section>
        </div>

        <div className="shrink-0 border-t border-white/10 p-4">
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${roleConfig.color}`} />
            <span className="text-sm text-slate-300">{roleConfig.name}</span>
          </div>
        </div>
      </aside>

      {showRecentChats && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowRecentChats(false)}
        >
          <div
            className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl dark:bg-gray-800"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 p-6 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900">
                  <History className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Recent Chats</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Your conversation history</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRecentChats(false)}
                className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {loadingChats ? (
                <p className="text-sm text-gray-500">Loading…</p>
              ) : recentChats.length === 0 ? (
                <p className="text-sm text-gray-500">No recent chats yet.</p>
              ) : (
                <div className="space-y-2">
                  {recentChats.map((chat) => (
                    <button
                      key={chat.id}
                      type="button"
                      onClick={() => {
                        navigate('/chat');
                        setShowRecentChats(false);
                        closeIfMobile();
                      }}
                      className="w-full rounded-xl border border-gray-200 p-3 text-left hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/50"
                    >
                      <div className="font-medium text-gray-900 dark:text-white">
                        {chat.title || 'Untitled chat'}
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        {chat.updatedAt ? new Date(chat.updatedAt).toLocaleString() : '—'}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
