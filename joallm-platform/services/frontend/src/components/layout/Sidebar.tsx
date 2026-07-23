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
  Palette,
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
import { PRODUCT_DESCRIPTIONS, PRODUCT_LABELS, PLATFORM_CONSTITUTION } from '../../constants/product';
import { CHROME_SECTIONS } from '../../constants/ontology';
import { USE_CASES, type UseCaseDefinition } from '../../constants/useCases';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  onQuickPrompt?: (prompt: string) => void;
  onOpenKnowledge?: () => void;
  onOpenSettings?: () => void;
  onOpenCreativeSettings?: () => void;
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
      <span className="inline-flex items-center rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-800 ring-1 ring-teal-200 dark:bg-teal-500/20 dark:text-teal-200 dark:ring-teal-400/30">
        Live
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 ring-1 ring-slate-200 dark:bg-slate-500/20 dark:text-slate-300 dark:ring-white/10">
      Soon
    </span>
  );
}

const sectionLabel = 'text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400';
const sectionHint = 'text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500';
const sectionCopy = 'mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400';
const sectionBorder = 'border-b border-slate-200/80 dark:border-white/10';

function navButtonClass(isActive: boolean, disabled = false) {
  if (disabled) {
    return 'cursor-not-allowed border-slate-100 bg-slate-50/60 opacity-60 dark:border-white/5 dark:bg-white/[0.02]';
  }
  if (isActive) {
    return 'border-teal-300/80 bg-teal-50 shadow-sm dark:border-teal-400/40 dark:bg-teal-500/15';
  }
  return 'border-slate-200/80 bg-white/60 hover:border-teal-200 hover:bg-teal-50/50 dark:border-white/8 dark:bg-white/4 dark:hover:border-teal-400/30 dark:hover:bg-white/8';
}

function iconTileClass(isActive: boolean) {
  if (isActive) {
    return 'bg-teal-600 text-white dark:bg-teal-400 dark:text-slate-950';
  }
  return 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-white';
}

export function Sidebar({
  isOpen,
  onToggle,
  currentView,
  onViewChange,
  onOpenSettings,
  onOpenCreativeSettings,
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

  const brainNavigation = useMemo<NavItem[]>(
    () => [
      {
        id: 'welcome',
        icon: Home,
        label: 'Home',
        description: 'Brain overview and next actions',
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
        label: 'Studio directory',
        description: PRODUCT_DESCRIPTIONS.workflows,
        status: 'live',
      },
    ],
    [],
  );

  const platformTooling = useMemo(
    () => [
      {
        id: 'creative',
        icon: Palette,
        label: 'Creative AI',
        description: 'BYOK providers for Generation Profiles',
        action: () => {
          if (onOpenCreativeSettings) {
            onOpenCreativeSettings();
          } else if (onOpenSettings) {
            onOpenSettings();
          }
          closeIfMobile();
        },
      },
      {
        id: 'notebook',
        icon: BookOpen,
        label: PRODUCT_LABELS.notebooks,
        description: PRODUCT_DESCRIPTIONS.notebooks,
        action: () => handleNavigate('notebook'),
      },
      {
        id: 'farm',
        icon: Database,
        label: PRODUCT_LABELS.models,
        description: PRODUCT_DESCRIPTIONS.models,
        action: () => handleNavigate('farm'),
      },
    ],
    [onOpenCreativeSettings, onOpenSettings, isDesktop],
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
        className={`app-sidebar-shell z-50 flex w-[min(20rem,calc(100vw-1rem))] max-w-full flex-col lg:m-3 lg:mr-0 lg:w-80 lg:shrink-0 lg:rounded-[28px] ${
          isDesktop
            ? 'relative h-[calc(100dvh-1.5rem)]'
            : 'fixed inset-y-0 left-0 animate-in slide-in-from-left duration-300'
        }`}
      >
        <div className={`flex shrink-0 items-center justify-between p-4 ${sectionBorder}`}>
          <SidebarLogo />
          {!isDesktop && (
            <button
              onClick={onToggle}
              className="rounded-xl p-2 text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
              title="Close sidebar"
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          <section className={`p-4 ${sectionBorder}`}>
            <div className="flex items-center justify-between gap-2">
              <p className={sectionLabel}>{CHROME_SECTIONS.brain}</p>
              <span className={sectionHint}>{CHROME_SECTIONS.brainHint}</span>
            </div>
            <p className={sectionCopy}>{PLATFORM_CONSTITUTION}</p>
            <div className="mt-3 space-y-2">
              {brainNavigation.map((item) => {
                const isActive =
                  currentView === item.id ||
                  (item.id === 'workflow' &&
                    location.pathname.startsWith('/studio') &&
                    location.pathname === '/studio');

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavigate(item.id)}
                    className={`w-full rounded-xl border p-3 text-left transition-colors ${navButtonClass(isActive)}`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconTileClass(isActive)}`}
                      >
                        <item.icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-medium text-slate-900 dark:text-white">{item.label}</div>
                          <StatusPill status={item.status} />
                        </div>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.description}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className={`p-4 ${sectionBorder}`}>
            <div className="flex items-center justify-between gap-2">
              <p className={sectionLabel}>{CHROME_SECTIONS.studio}</p>
              <span className={sectionHint}>
                {CHROME_SECTIONS.studioHint} · {studioWorkspaces.filter((w) => w.status === 'active').length} live
              </span>
            </div>
            <p className={sectionCopy}>
              Live workspaces are ready. Data Intelligence stays Soon.
            </p>
            <div className="mt-3 space-y-2">
              {studioWorkspaces.map((workspace) => {
                const Icon = STUDIO_ICONS[workspace.id] || Workflow;
                const isLive = workspace.status === 'active';
                const isClickable = isLive;
                const isActive =
                  isClickable && location.pathname.startsWith(workspace.homeRoute);

                return (
                  <button
                    key={workspace.id}
                    type="button"
                    disabled={!isClickable}
                    onClick={() => handleStudioNav(workspace)}
                    className={`w-full rounded-xl border p-3 text-left transition-colors ${navButtonClass(isActive, !isClickable)}`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconTileClass(isActive)}`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-medium text-slate-900 dark:text-white">{workspace.label}</div>
                          <StatusPill status={isLive ? 'live' : 'soon'} />
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                          {workspace.description}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className={`p-4 ${sectionBorder}`}>
            <div className="flex items-center justify-between gap-2">
              <p className={sectionLabel}>{CHROME_SECTIONS.platform}</p>
              <span className={sectionHint}>{CHROME_SECTIONS.platformHint}</span>
            </div>
            <div className="mt-3 space-y-2">
              {platformTooling.map((item) => {
                const isActive =
                  (item.id === 'notebook' && currentView === 'notebook') ||
                  (item.id === 'farm' && currentView === 'farm') ||
                  (item.id === 'creative' && location.pathname.startsWith('/studio/creative'));

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={item.action}
                    className={`w-full rounded-xl border p-3 text-left transition-colors ${navButtonClass(isActive)}`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconTileClass(isActive)}`}
                      >
                        <item.icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-slate-900 dark:text-white">{item.label}</div>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.description}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="p-4">
            <p className={sectionLabel}>{CHROME_SECTIONS.utilities}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {utilities.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.action}
                  className="rounded-xl border border-slate-200/80 bg-white/60 p-3 text-left transition-colors hover:border-teal-200 hover:bg-teal-50/50 dark:border-white/8 dark:bg-white/4 dark:hover:border-white/14 dark:hover:bg-white/8"
                >
                  <item.icon className="h-4 w-4 text-slate-700 dark:text-white" />
                  <p className="mt-2 text-sm text-slate-800 dark:text-white">{item.label}</p>
                </button>
              ))}
            </div>
          </section>
        </div>

        <div className={`shrink-0 p-4 ${sectionBorder.replace('border-b', 'border-t')}`}>
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${roleConfig.color}`} />
            <span className="text-sm text-slate-600 dark:text-slate-300">{roleConfig.name}</span>
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
