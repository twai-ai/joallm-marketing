import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { storage, STORAGE_KEYS } from '../utils/storage';

export type UserRole = 'developer' | 'analyst' | 'business' | 'casual';

interface RoleConfig {
  name: string;
  description: string;
  color: string;
  bgColor: string;
  textColor: string;
  icon: string;
  features: string[];
  defaultPrompts: Array<{ name: string; prompt: string; category: string }>;
  defaultView: string;
  accessLevel: number;
  modules: string[];
  onboardingSteps: string[];
  upgradePath?: UserRole[];
}

interface UserRoleContextType {
  role: UserRole;
  setRole: (role: UserRole) => void;
  getRoleConfig: () => RoleConfig;
  canAccess: (module: string) => boolean;
  getDefaultView: () => string;
  getOnboardingSteps: () => string[];
  canUpgrade: () => UserRole[];
  isFirstTime: boolean;
  completeOnboarding: () => void;
}

const roleConfigs: Record<UserRole, RoleConfig> = {
  developer: {
    name: 'Developer',
    description: 'Full technical access to workflows, APIs, and model configuration',
    color: 'bg-blue-500',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-600',
    icon: '🛠️',
    features: [
      'Workflow Builder',
      'API Keys Management', 
      'Model Configuration',
      'Debug Tools',
      'Code Generation',
      'System Architecture',
      'Advanced Analytics',
      'Full Observability'
    ],
    defaultPrompts: [
      { name: 'Code Review', prompt: 'Review this code for best practices and potential issues:', category: 'Development' },
      { name: 'Debug Helper', prompt: 'Help me debug this error:', category: 'Development' },
      { name: 'Architecture Design', prompt: 'Design a system architecture for:', category: 'Planning' },
      { name: 'API Documentation', prompt: 'Generate API documentation for:', category: 'Documentation' },
    ],
    defaultView: 'workflow',
    accessLevel: 4,
    modules: ['workflow', 'notebook', 'chat', 'rag-search', 'farm', 'docs', 'settings', 'admin'],
    onboardingSteps: [
      'Welcome to Developer Mode',
      'Explore Workflow Builder',
      'Configure API Keys',
      'Set up Model Preferences',
      'Create Your First Workflow'
    ]
  },
  analyst: {
    name: 'Data Analyst',
    description: 'Data-focused tools for notebooks, retrieval pipelines, and analytics',
    color: 'bg-green-500',
    bgColor: 'bg-green-50',
    textColor: 'text-green-600',
    icon: '📊',
    features: [
      'Interactive Notebooks',
      'RAG Builder',
      'Knowledge Manager',
      'Data Visualization',
      'Statistical Analysis',
      'Report Generation',
      'Chart Creation',
      'Dataset Ingestion'
    ],
    defaultPrompts: [
      { name: 'Data Summary', prompt: 'Analyze this dataset and provide key insights:', category: 'Analysis' },
      { name: 'Trend Analysis', prompt: 'Identify trends and patterns in:', category: 'Analysis' },
      { name: 'Report Generator', prompt: 'Generate a business report for:', category: 'Reporting' },
      { name: 'Data Visualization', prompt: 'Create a visualization for this data:', category: 'Visualization' },
    ],
    defaultView: 'notebook',
    accessLevel: 3,
    modules: ['notebook', 'rag-search', 'chat', 'farm', 'docs'],
    onboardingSteps: [
      'Welcome to Analyst Mode',
      'Explore Interactive Notebooks',
      'Set up Knowledge Base',
      'Learn RAG Search',
      'Create Your First Analysis'
    ],
    upgradePath: ['developer']
  },
  business: {
    name: 'Business User',
    description: 'No-code automation, reporting, and business workflows',
    color: 'bg-purple-500',
    bgColor: 'bg-purple-50',
    textColor: 'text-purple-600',
    icon: '💼',
    features: [
      'Workflow Templates',
      'Business Reports',
      'Prompt Library',
      'Content Creation',
      'Document Analysis',
      'Meeting Summaries',
      'Email Drafting',
      'Dashboard Views'
    ],
    defaultPrompts: [
      { name: 'Meeting Summary', prompt: 'Summarize the key points from this meeting:', category: 'Business' },
      { name: 'Email Draft', prompt: 'Help me write a professional email about:', category: 'Communication' },
      { name: 'Presentation Outline', prompt: 'Create an outline for a presentation on:', category: 'Business' },
      { name: 'Business Analysis', prompt: 'Analyze this business scenario:', category: 'Analysis' },
    ],
    defaultView: 'chat',
    accessLevel: 2,
    modules: ['chat', 'rag-search', 'docs'],
    onboardingSteps: [
      'Welcome to Business Mode',
      'Explore Chat Interface',
      'Learn Document Upload',
      'Try Business Templates',
      'Set up Your Workspace'
    ],
    upgradePath: ['analyst', 'developer']
  },
  casual: {
    name: 'Casual User',
    description: 'Chat-first experience with prebuilt AI assistants',
    color: 'bg-orange-500',
    bgColor: 'bg-orange-50',
    textColor: 'text-orange-600',
    icon: '💬',
    features: [
      'Quick Chat',
      'Basic Tasks',
      'Simple Templates',
      'Prebuilt Agents',
      'General Help',
      'Learning Mode'
    ],
    defaultPrompts: [
      { name: 'General Help', prompt: 'Can you help me with:', category: 'General' },
      { name: 'Explain Simply', prompt: 'Explain in simple terms:', category: 'Learning' },
      { name: 'Quick Question', prompt: 'I have a quick question about:', category: 'General' },
      { name: 'Creative Writing', prompt: 'Help me write:', category: 'Creative' },
    ],
    defaultView: 'chat',
    accessLevel: 1,
    modules: ['chat'],
    onboardingSteps: [
      'Welcome to ATRISI Marketing',
      'Start Your First Chat',
      'Try Quick Actions',
      'Explore Templates',
      'Discover Features'
    ],
    upgradePath: ['business', 'analyst', 'developer']
  }
};

const UserRoleContext = createContext<UserRoleContextType | undefined>(undefined);

export function EnhancedUserRoleProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [role, setRole] = useState<UserRole>('casual');
  const [isFirstTime, setIsFirstTime] = useState(false);

  // Initialize role based on user data or stored preference
  useEffect(() => {
    const initializeRole = () => {
      // Check if onboarding has been completed
      const onboardingComplete = storage.get<boolean>('joallm_onboarding_complete');
      
      // Set isFirstTime based on onboarding status
      setIsFirstTime(!onboardingComplete);
      
      // Check if user has a stored role preference
      const storedRole = storage.get<UserRole>(STORAGE_KEYS.USER_ROLE);
      
      if (storedRole && roleConfigs[storedRole]) {
        setRole(storedRole);
      } else if (user) {
        // Map backend user role to frontend role
        const backendRole = user.role;
        const mappedRole = mapBackendRoleToFrontend(backendRole);
        setRole(mappedRole);
        storage.set(STORAGE_KEYS.USER_ROLE, mappedRole);
      } else {
        // Default to casual for new users
        setRole('casual');
      }
    };

    initializeRole();
  }, [user]);

  // Map backend user roles to frontend roles
  const mapBackendRoleToFrontend = (backendRole: string): UserRole => {
    switch (backendRole) {
      case 'admin':
        return 'developer';
      case 'premium':
        return 'analyst';
      case 'user':
      default:
        return 'business';
    }
  };

  const handleSetRole = (newRole: UserRole) => {
    setRole(newRole);
    storage.set(STORAGE_KEYS.USER_ROLE, newRole);
    
    // Track role changes for analytics
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'role_change', {
        event_category: 'user_behavior',
        event_label: newRole,
        value: roleConfigs[newRole].accessLevel
      });
    }
  };

  const getRoleConfig = () => roleConfigs[role];

  const canAccess = (module: string): boolean => {
    const config = getRoleConfig();
    return config.modules.includes(module);
  };

  const getDefaultView = (): string => {
    return getRoleConfig().defaultView;
  };

  const getOnboardingSteps = (): string[] => {
    return getRoleConfig().onboardingSteps;
  };

  const canUpgrade = (): UserRole[] => {
    const config = getRoleConfig();
    return config.upgradePath || [];
  };

  const completeOnboarding = () => {
    setIsFirstTime(false);
    storage.set('joallm_onboarding_complete', true);
  };

  const value: UserRoleContextType = {
    role,
    setRole: handleSetRole,
    getRoleConfig,
    canAccess,
    getDefaultView,
    getOnboardingSteps,
    canUpgrade,
    isFirstTime,
    completeOnboarding,
  };

  return (
    <UserRoleContext.Provider value={value}>
      {children}
    </UserRoleContext.Provider>
  );
}

export function useUserRole() {
  const context = useContext(UserRoleContext);
  if (context === undefined) {
    throw new Error('useUserRole must be used within an EnhancedUserRoleProvider');
  }
  return context;
}

// Utility functions for role-based access control
export const RoleUtils = {
  // Check if user can access a specific module
  hasAccess: (userRole: UserRole, module: string): boolean => {
    return roleConfigs[userRole].modules.includes(module);
  },

  // Get all available modules for a role
  getAvailableModules: (userRole: UserRole): string[] => {
    return roleConfigs[userRole].modules;
  },

  // Check if user can upgrade to a specific role
  canUpgradeTo: (currentRole: UserRole, targetRole: UserRole): boolean => {
    const config = roleConfigs[currentRole];
    return config.upgradePath?.includes(targetRole) || false;
  },

  // Get role hierarchy (for admin purposes)
  getRoleHierarchy: (): Array<{ role: UserRole; level: number; name: string }> => {
    return Object.entries(roleConfigs).map(([role, config]) => ({
      role: role as UserRole,
      level: config.accessLevel,
      name: config.name
    })).sort((a, b) => b.level - a.level);
  },

  // Get role by access level
  getRoleByLevel: (level: number): UserRole | null => {
    const entry = Object.entries(roleConfigs).find(([, config]) => config.accessLevel === level);
    return entry ? (entry[0] as UserRole) : null;
  }
};
