import React, { useEffect, useMemo, useState } from 'react';
import {
  Book,
  BookOpen,
  Bookmark,
  Clock,
  Database,
  FileText,
  History,
  Home,
  Lightbulb,
  MessageSquare,
  Search,
  Settings,
  Trash2,
  Users,
  Workflow,
  Wrench,
  X,
} from 'lucide-react';
import { useUserRole } from '../../contexts/EnhancedUserRoleContext';
import { SidebarLogo } from '../ui/Logo';
import type { ViewMode } from '../../App';
import { apiClient } from '../../utils/api-client';
import { showError } from '../../utils/toast';
import { PRODUCT_DESCRIPTIONS, PRODUCT_LABELS } from '../../constants/product';

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
};

type ContextContent = {
  title: string;
  description: string;
  helper: string;
  actions: Array<{
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    action: () => void;
    variant?: 'primary' | 'secondary';
  }>;
};

const QUICK_PROMPTS = [
  { icon: Lightbulb, text: 'Explain quantum computing in simple terms' },
  { icon: FileText, text: 'Help me write a professional email' },
];

export function Sidebar({
  isOpen,
  onToggle,
  currentView,
  onViewChange,
  onQuickPrompt,
  onOpenSettings,
  onOpenBookmarks,
}: SidebarProps) {
  const { getRoleConfig } = useUserRole();
  const roleConfig = getRoleConfig();
  const [showRecentChats, setShowRecentChats] = useState(false);
  const [recentChats, setRecentChats] = useState<any[]>([]);
  const [loadingChats, setLoadingChats] = useState(false);

  useEffect(() => {
    if (showRecentChats && recentChats.length === 0) {
      void fetchRecentChats();
    }
  }, [showRecentChats, recentChats.length]);

  const fetchRecentChats = async () => {
    setLoadingChats(true);
    try {
      const response = await apiClient.get('/api/chat/sessions?limit=10');
      setRecentChats(response.sessions || []);
    } catch (error) {
      console.error('Failed to fetch recent chats:', error);
      showError('Failed to load recent chats');
    } finally {
      setLoadingChats(false);
    }
  };

  const handleNavigate = (view: ViewMode) => {
    onViewChange(view);
    onToggle();
  };

  const handleQuickPrompt = (prompt: string) => {
    if (!onQuickPrompt) {
      return;
    }

    onQuickPrompt(prompt);
    onViewChange('chat');
    onToggle();
  };

  const coreNavigation = useMemo<NavItem[]>(
    () => [
      {
        id: 'welcome',
        icon: Home,
        label: 'Welcome',
        description: 'Platform overview and guided entry points',
      },
      {
        id: 'chat',
        icon: MessageSquare,
        label: PRODUCT_LABELS.chat,
        description: PRODUCT_DESCRIPTIONS.chat,
      },
      {
        id: 'rag-search',
        icon: Search,
        label: PRODUCT_LABELS.knowledge,
        description: PRODUCT_DESCRIPTIONS.knowledge,
      },
      {
        id: 'workflow',
        icon: Workflow,
        label: PRODUCT_LABELS.workflows,
        description: PRODUCT_DESCRIPTIONS.workflows,
      },
      {
        id: 'notebook',
        icon: BookOpen,
        label: PRODUCT_LABELS.notebooks,
        description: PRODUCT_DESCRIPTIONS.notebooks,
      },
      {
        id: 'farm',
        icon: Database,
        label: PRODUCT_LABELS.models,
        description: PRODUCT_DESCRIPTIONS.models,
      },
    ],
    [],
  );

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
            onToggle();
          }
        },
      },
      {
        label: 'Settings',
        icon: Settings,
        action: () => {
          if (onOpenSettings) {
            onOpenSettings();
            onToggle();
          }
        },
      },
      {
        label: PRODUCT_LABELS.documentation,
        icon: Book,
        action: () => handleNavigate('docs'),
      },
    ],
    [onOpenBookmarks, onOpenSettings],
  );

  const contextContent = useMemo<ContextContent>(() => {
    switch (currentView) {
      case 'chat':
        return {
          title: PRODUCT_LABELS.chat,
          description: 'Continue conversations, inspect recent threads, or jump in with a prompt.',
          helper: 'Use recent chats when you need continuity. Start a fresh thread when the task changes.',
          actions: [
            {
              label: 'Open Recent Chats',
              icon: History,
              action: () => setShowRecentChats(true),
              variant: 'primary',
            },
            ...QUICK_PROMPTS.map((prompt) => ({
              label: prompt.text,
              icon: prompt.icon,
              action: () => handleQuickPrompt(prompt.text),
              variant: 'secondary' as const,
            })),
          ],
        };
      case 'rag-search':
        return {
          title: PRODUCT_LABELS.knowledge,
          description: 'Upload documents, watch indexing status, and ask grounded questions from one place.',
          helper: 'Wait for documents to become ready before asking questions so retrieval can use them.',
          actions: [
            {
              label: 'Open Knowledge Workspace',
              icon: Search,
              action: () => handleNavigate('rag-search'),
              variant: 'primary',
            },
            {
              label: 'Ask in Chat',
              icon: MessageSquare,
              action: () => handleNavigate('chat'),
              variant: 'secondary',
            },
          ],
        };
      case 'workflow':
        return {
          title: PRODUCT_LABELS.workflows,
          description: 'Studio is the umbrella workspace for guided workflow families, with Media AI, Acquisition Intelligence, and Document AI available today.',
          helper: 'Open Media AI for recordings, Acquisition Intelligence for WhatsApp/Meta timelines, or Document AI for grounded document workflows.',
          actions: [
            {
              label: 'Open Media in Studio',
              icon: Workflow,
              action: () => {
                window.location.assign('/studio/media-ai');
                onToggle();
              },
              variant: 'primary',
            },
            {
              label: 'Open Acquisition Intelligence',
              icon: Users,
              action: () => {
                window.location.assign('/studio/acquisition');
                onToggle();
              },
              variant: 'secondary',
            },
            {
              label: 'Open Document AI',
              icon: FileText,
              action: () => {
                window.location.assign('/studio/document-ai');
                onToggle();
              },
              variant: 'secondary',
            },
          ],
        };
      case 'notebook':
        return {
          title: PRODUCT_LABELS.notebooks,
          description: 'Use notebooks for iterative work that benefits from visible steps and saved outputs.',
          helper: 'Mix text and code cells when you want a clearer audit trail than chat alone can provide.',
          actions: [
            {
              label: 'Open Notebook',
              icon: BookOpen,
              action: () => handleNavigate('notebook'),
              variant: 'primary',
            },
          ],
        };
      case 'farm':
        return {
          title: PRODUCT_LABELS.models,
          description: 'Review available models and compare which one best matches the task.',
          helper: 'Use Models when cost, latency, or provider fit matters more than staying in a single default.',
          actions: [
            {
              label: 'Browse Models',
              icon: Database,
              action: () => handleNavigate('farm'),
              variant: 'primary',
            },
          ],
        };
      case 'docs':
        return {
          title: PRODUCT_LABELS.documentation,
          description: 'Keep implementation notes and planning documents accessible without cluttering primary work.',
          helper: 'Documentation should support the workflow, not compete with it.',
          actions: [
            {
              label: 'Open Documentation',
              icon: Book,
              action: () => handleNavigate('docs'),
              variant: 'primary',
            },
          ],
        };
      case 'welcome':
      default:
        return {
          title: 'Get Started',
          description: 'Start with Studio for guided workflows, then move into Knowledge or Chat as needed.',
          helper: 'For the clearest first value, open Media AI for recordings or Document AI for document ingestion and readiness tracking.',
          actions: [
            {
              label: `Open ${PRODUCT_LABELS.workflows}`,
              icon: Workflow,
              action: () => {
                window.location.assign('/studio/media-ai');
                onToggle();
              },
              variant: 'primary',
            },
            {
              label: 'Open Document AI',
              icon: FileText,
              action: () => {
                window.location.assign('/studio/document-ai');
                onToggle();
              },
              variant: 'secondary',
            },
            {
              label: `Open ${PRODUCT_LABELS.knowledge}`,
              icon: Search,
              action: () => handleNavigate('rag-search'),
              variant: 'secondary',
            },
          ],
        };
    }
  }, [currentView, onQuickPrompt]);

  if (!isOpen) {
    return null;
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/50 animate-in fade-in duration-200"
        onClick={onToggle}
      />

      <div className="app-sidebar-shell fixed inset-y-0 left-0 z-50 flex w-[min(20rem,calc(100vw-1rem))] max-w-full flex-col shadow-xl animate-in slide-in-from-left duration-300 lg:relative lg:m-3 lg:mr-0 lg:w-80 lg:rounded-[28px] lg:border lg:border-white/10">
        <div className="flex items-center justify-between border-b border-white/10 p-4">
          <SidebarLogo />
          <button
            onClick={onToggle}
            className="rounded-xl p-2 transition-colors hover:bg-white/10"
            title="Close sidebar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <section className="border-b border-white/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Core Work</p>
            <div className="mt-3 space-y-2">
              {coreNavigation.map((item) => {
                const isActive = currentView === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavigate(item.id)}
                    className={`w-full rounded-xl border p-3 text-left transition-colors ${
                      isActive
                        ? 'border-white/20 bg-white/12 shadow-[0_12px_24px_rgba(15,23,42,0.14)]'
                        : 'border-white/8 bg-white/4 hover:border-white/14 hover:bg-white/8'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl ${
                          isActive ? 'bg-white text-joa-primary' : 'bg-white/10 text-white'
                        }`}
                      >
                        <item.icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-white">{item.label}</div>
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
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Current Context</p>
            <div className="mt-3 rounded-[24px] border border-white/10 bg-white/6 p-4 backdrop-blur-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white">
                  <Wrench className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-medium text-white">{contextContent.title}</h3>
                  <p className="mt-1 text-sm text-slate-200">{contextContent.description}</p>
                </div>
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-400">{contextContent.helper}</p>
              <div className="mt-4 space-y-2">
                {contextContent.actions.map((action) => (
                  <button
                    key={action.label}
                    onClick={action.action}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      action.variant === 'primary'
                        ? 'bg-white text-slate-900 hover:bg-slate-100'
                        : 'bg-white/10 text-slate-100 hover:bg-white/14'
                    }`}
                  >
                    <action.icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{action.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Utilities</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {utilities.map((item) => (
                <button
                  key={item.label}
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

        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${roleConfig.color}`} />
            <span className="text-sm text-slate-300">{roleConfig.name}</span>
          </div>
        </div>
      </div>

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
                onClick={() => setShowRecentChats(false)}
                className="rounded-lg p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {loadingChats ? (
                <div className="flex justify-center py-12">
                  <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
                </div>
              ) : recentChats.length === 0 ? (
                <div className="py-12 text-center">
                  <MessageSquare className="mx-auto mb-4 h-12 w-12 text-gray-400" />
                  <p className="text-gray-500 dark:text-gray-400">No recent chats found</p>
                  <p className="mt-2 text-sm text-gray-400 dark:text-gray-500">
                    Start a new conversation to see it here
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentChats.map((chat) => (
                    <div
                      key={chat.id}
                      className="group cursor-pointer rounded-lg bg-gray-50 p-4 transition-colors hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600"
                      onClick={() => {
                        onViewChange('chat');
                        setShowRecentChats(false);
                        onToggle();
                        window.history.pushState({}, '', `/chat/${chat.shortId || chat.id}`);
                      }}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate font-medium text-gray-900 dark:text-white">
                            {chat.title || 'Untitled Chat'}
                          </h3>
                          <div className="mt-2 flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                            <div className="flex items-center">
                              <Clock className="mr-1 h-4 w-4" />
                              {new Date(chat.createdAt).toLocaleDateString()}
                            </div>
                            <div className="flex items-center">
                              <MessageSquare className="mr-1 h-4 w-4" />
                              {chat.model || 'AI Model'}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={async (event) => {
                            event.stopPropagation();
                            try {
                              await apiClient.delete(`/api/chat/sessions/${chat.id}`);
                              setRecentChats((previous) => previous.filter((item) => item.id !== chat.id));
                            } catch (error) {
                              showError('Failed to delete chat');
                            }
                          }}
                          className="rounded-lg p-2 opacity-0 transition-all hover:bg-teal-100 group-hover:opacity-100 dark:hover:bg-red-900"
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-gray-200 p-6 dark:border-gray-700">
              <button
                onClick={() => {
                  onViewChange('chat');
                  setShowRecentChats(false);
                  onToggle();
                }}
                className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white transition-colors hover:bg-blue-700"
              >
                Start New Chat
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
