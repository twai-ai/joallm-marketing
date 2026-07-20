import React, { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { storage, STORAGE_KEYS } from '../utils/storage';
import { preferencesApi } from '../services/preferencesApi';
import { apiClient } from '../utils/api-client';
import type { Permission, SubscriptionTier, UserAccess, UserRole, WorkspaceMode } from '../types';

export type { WorkspaceMode };

interface WorkspaceConfig {
  name: string;
  description: string;
  color: string;
  bgColor: string;
  textColor: string;
  icon: string;
  features: string[];
  defaultPrompts: Array<{ name: string; prompt: string; category: string }>;
  defaultView: string;
  onboardingSteps: string[];
}

interface UserRoleContextType {
  role: WorkspaceMode;
  workspaceMode: WorkspaceMode;
  setRole: (workspaceMode: WorkspaceMode) => Promise<void>;
  setWorkspaceMode: (workspaceMode: WorkspaceMode) => Promise<void>;
  getRoleConfig: () => WorkspaceConfig;
  canAccess: (module: string) => boolean;
  hasPermission: (permission: Permission) => boolean;
  getDefaultView: () => string;
  getOnboardingSteps: () => string[];
  canUpgrade: () => WorkspaceMode[];
  isFirstTime: boolean;
  completeOnboarding: () => void;
  backendRole: UserRole;
  subscriptionTier: SubscriptionTier;
  permissions: Permission[];
  limits: UserAccess['limits'] | null;
  accessLoaded: boolean;
}

const DEFAULT_LIMITS: UserAccess['limits'] = {
  maxFiles: 0,
  maxStorageMB: 0,
  maxChatSessions: 0,
  maxWorkflows: 0,
  maxNotebooks: 0,
  maxApiRequestsPerDay: 0,
  canUseCustomApiKeys: false,
  canUseCloudStorage: false,
  canExportData: false,
};

export const roleConfigs: Record<WorkspaceMode, WorkspaceConfig> = {
  personal: {
    name: 'Personal Workspace',
    description: 'A focused setup for individual work, quick answers, and lightweight knowledge tasks.',
    color: 'bg-orange-500',
    bgColor: 'bg-orange-50',
    textColor: 'text-orange-600',
    icon: '💬',
    features: ['Chat', 'Knowledge lookups', 'Recent work', 'Personal settings'],
    defaultPrompts: [
      { name: 'Quick Question', prompt: 'Help me understand:', category: 'General' },
      { name: 'Summarize', prompt: 'Summarize this clearly:', category: 'General' },
      { name: 'Draft Reply', prompt: 'Draft a concise response to:', category: 'Writing' },
      { name: 'Plan Next Steps', prompt: 'Turn this into a practical next-step plan:', category: 'Planning' },
    ],
    defaultView: 'chat',
    onboardingSteps: [
      'Start a grounded chat',
      'Upload a document to Knowledge',
      'Verify an answer with sources',
      'Save your preferred workspace defaults',
    ],
  },
  team: {
    name: 'Team Workspace',
    description: 'A collaborative setup for shared knowledge, repeatable work, and operational visibility.',
    color: 'bg-blue-500',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-600',
    icon: '🤝',
    features: ['Shared Knowledge', 'Workflows', 'Usage visibility', 'Team-oriented navigation'],
    defaultPrompts: [
      { name: 'Meeting Summary', prompt: 'Summarize the key decisions and follow-ups from:', category: 'Teamwork' },
      { name: 'Workflow Brief', prompt: 'Turn this repeatable task into a workflow outline:', category: 'Operations' },
      { name: 'Knowledge Query', prompt: 'Answer this using the uploaded knowledge base:', category: 'Knowledge' },
      { name: 'Status Update', prompt: 'Create a status update for this workstream:', category: 'Communication' },
    ],
    defaultView: 'rag-search',
    onboardingSteps: [
      'Upload shared knowledge',
      'Wait for indexing to finish',
      'Ask a grounded question',
      'Turn repeatable work into a workflow',
    ],
  },
  enterprise: {
    name: 'Enterprise Workspace',
    description: 'A structured setup for governed access, scale, security, and multi-team operations.',
    color: 'bg-slate-700',
    bgColor: 'bg-slate-50',
    textColor: 'text-slate-700',
    icon: '🏢',
    features: ['Governed access', 'Workflow operations', 'Security visibility', 'Plan and usage context'],
    defaultPrompts: [
      { name: 'Executive Summary', prompt: 'Create an executive-ready summary of:', category: 'Leadership' },
      { name: 'Policy Review', prompt: 'Review this for operational or policy risk:', category: 'Governance' },
      { name: 'Runbook Draft', prompt: 'Draft a runbook for this process:', category: 'Operations' },
      { name: 'Decision Brief', prompt: 'Create a decision brief with risks and tradeoffs for:', category: 'Strategy' },
    ],
    defaultView: 'welcome',
    onboardingSteps: [
      'Review workspace access and plan',
      'Validate knowledge readiness',
      'Route important work through notebooks or workflows',
      'Monitor usage and security posture',
    ],
  },
};

const MODULE_PERMISSION_MAP: Partial<Record<string, Permission>> = {
  chat: 'chat.read',
  'rag-search': 'knowledge.read',
  notebook: 'notebook.read',
  workflow: 'workflow.read',
  settings: 'settings.manage',
  admin: 'admin.access',
};

const BACKEND_ROLE_PERMISSION_MAP: Record<UserRole, Permission[]> = {
  casual: ['chat.read', 'chat.write', 'knowledge.read', 'notebook.read', 'workflow.read', 'settings.manage'],
  premium: [
    'chat.read',
    'chat.write',
    'knowledge.read',
    'knowledge.write',
    'notebook.read',
    'notebook.write',
    'workflow.read',
    'workflow.execute',
    'workflow.manage',
    'settings.manage',
  ],
  admin: [
    'chat.read',
    'chat.write',
    'knowledge.read',
    'knowledge.write',
    'notebook.read',
    'notebook.write',
    'workflow.read',
    'workflow.execute',
    'workflow.manage',
    'settings.manage',
    'admin.access',
  ],
  superuser: [
    'chat.read',
    'chat.write',
    'knowledge.read',
    'knowledge.write',
    'notebook.read',
    'notebook.write',
    'workflow.read',
    'workflow.execute',
    'workflow.manage',
    'settings.manage',
    'admin.access',
    'admin.manage',
  ],
};

const LEGACY_WORKSPACE_MODE_MAP: Record<string, WorkspaceMode> = {
  developer: 'enterprise',
  analyst: 'team',
  business: 'team',
  casual: 'personal',
  personal: 'personal',
  team: 'team',
  enterprise: 'enterprise',
};

function normalizeWorkspaceMode(value: unknown): WorkspaceMode {
  if (typeof value !== 'string') {
    return 'personal';
  }

  return LEGACY_WORKSPACE_MODE_MAP[value] ?? 'personal';
}

const UserRoleContext = createContext<UserRoleContextType | undefined>(undefined);

export function EnhancedUserRoleProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [workspaceMode, setWorkspaceModeState] = useState<WorkspaceMode>('personal');
  const [isFirstTime, setIsFirstTime] = useState(false);
  const [accessSnapshot, setAccessSnapshot] = useState<UserAccess | null>(null);
  const [accessLoaded, setAccessLoaded] = useState(false);

  useEffect(() => {
    const onboardingComplete = storage.get<boolean>('joallm_onboarding_complete');
    setIsFirstTime(!onboardingComplete);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const initializeWorkspaceMode = async () => {
      const storedMode = normalizeWorkspaceMode(storage.get<string>(STORAGE_KEYS.USER_ROLE));

      setWorkspaceModeState(storedMode);
      storage.set(STORAGE_KEYS.USER_ROLE, storedMode);

      if (!isAuthenticated) {
        setAccessSnapshot(null);
        setAccessLoaded(true);
        return;
      }

      try {
        const access = await apiClient.get<UserAccess>('/api/me/access', { showErrorToast: false, retries: 0 });
        if (cancelled) {
          return;
        }

        setAccessSnapshot(access);
        setWorkspaceModeState(access.workspaceMode);
        storage.set(STORAGE_KEYS.USER_ROLE, access.workspaceMode);
      } catch (error) {
        if (cancelled) {
          return;
        }

        const fallbackMode = storedMode;
        const fallbackRole = (user?.role ?? 'casual') as UserRole;
        const fallbackTier = (user?.subscriptionTier ?? 'free') as SubscriptionTier;

        setWorkspaceModeState(fallbackMode);
        setAccessSnapshot({
          role: fallbackRole,
          subscriptionTier: fallbackTier,
          workspaceMode: fallbackMode,
          permissions: BACKEND_ROLE_PERMISSION_MAP[fallbackRole] ?? [],
          limits: DEFAULT_LIMITS,
        });
      } finally {
        if (!cancelled) {
          setAccessLoaded(true);
        }
      }
    };

    void initializeWorkspaceMode();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user?.role, user?.subscriptionTier]);

  const handleSetWorkspaceMode = async (nextMode: WorkspaceMode) => {
    setWorkspaceModeState(nextMode);
    storage.set(STORAGE_KEYS.USER_ROLE, nextMode);

    setAccessSnapshot((current) =>
      current
        ? {
            ...current,
            workspaceMode: nextMode,
          }
        : current,
    );

    try {
      await preferencesApi.updatePreferences({ workspaceMode: nextMode });
    } catch (error) {
      // Keep the UI responsive even if the backend preference write is not ready yet.
      console.warn('Failed to persist workspace mode preference:', error);
    }

    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'workspace_mode_change', {
        event_category: 'user_behavior',
        event_label: nextMode,
      });
    }
  };

  const effectivePermissions = useMemo<Permission[]>(() => {
    if (accessSnapshot?.permissions?.length) {
      return accessSnapshot.permissions;
    }

    const backendRole = (user?.role ?? 'casual') as UserRole;
    return BACKEND_ROLE_PERMISSION_MAP[backendRole] ?? [];
  }, [accessSnapshot?.permissions, user?.role]);

  const hasPermission = (permission: Permission) => effectivePermissions.includes(permission);

  const canAccess = (module: string): boolean => {
    if (module === 'welcome' || module === 'docs' || module === 'farm') {
      return true;
    }

    const permission = MODULE_PERMISSION_MAP[module];
    if (!permission) {
      return true;
    }

    return hasPermission(permission);
  };

  const getRoleConfig = () => roleConfigs[normalizeWorkspaceMode(workspaceMode)];

  const getDefaultView = (): string => getRoleConfig().defaultView;

  const getOnboardingSteps = (): string[] => getRoleConfig().onboardingSteps;

  const canUpgrade = (): WorkspaceMode[] => Object.keys(roleConfigs).filter((mode) => mode !== workspaceMode) as WorkspaceMode[];

  const completeOnboarding = () => {
    setIsFirstTime(false);
    storage.set('joallm_onboarding_complete', true);
  };

  const value: UserRoleContextType = {
    role: workspaceMode,
    workspaceMode,
    setRole: handleSetWorkspaceMode,
    setWorkspaceMode: handleSetWorkspaceMode,
    getRoleConfig,
    canAccess,
    hasPermission,
    getDefaultView,
    getOnboardingSteps,
    canUpgrade,
    isFirstTime,
    completeOnboarding,
    backendRole: accessSnapshot?.role ?? ((user?.role ?? 'casual') as UserRole),
    subscriptionTier: accessSnapshot?.subscriptionTier ?? ((user?.subscriptionTier ?? 'free') as SubscriptionTier),
    permissions: effectivePermissions,
    limits: accessSnapshot?.limits ?? null,
    accessLoaded,
  };

  return <UserRoleContext.Provider value={value}>{children}</UserRoleContext.Provider>;
}

export function useUserRole() {
  const context = useContext(UserRoleContext);
  if (context === undefined) {
    throw new Error('useUserRole must be used within an EnhancedUserRoleProvider');
  }
  return context;
}

export const RoleUtils = {
  hasAccess: (workspaceMode: WorkspaceMode, module: string): boolean => {
    if (module === 'welcome' || module === 'docs' || module === 'farm') {
      return true;
    }
    const permission = MODULE_PERMISSION_MAP[module];
    if (!permission) {
      return true;
    }
    return permission !== 'admin.access' || workspaceMode === 'enterprise';
  },

  getAvailableModules: (workspaceMode: WorkspaceMode): string[] => {
    const allModules = ['chat', 'rag-search', 'notebook', 'workflow', 'farm', 'docs', 'settings', 'admin'];
    return allModules.filter((module) => RoleUtils.hasAccess(workspaceMode, module));
  },

  canUpgradeTo: (currentMode: WorkspaceMode, targetMode: WorkspaceMode): boolean => currentMode !== targetMode,

  getRoleHierarchy: (): Array<{ role: WorkspaceMode; level: number; name: string }> => [
    { role: 'enterprise', level: 3, name: roleConfigs.enterprise.name },
    { role: 'team', level: 2, name: roleConfigs.team.name },
    { role: 'personal', level: 1, name: roleConfigs.personal.name },
  ],

  getRoleByLevel: (level: number): WorkspaceMode | null => {
    const entry = RoleUtils.getRoleHierarchy().find((item) => item.level === level);
    return entry?.role ?? null;
  },
};
