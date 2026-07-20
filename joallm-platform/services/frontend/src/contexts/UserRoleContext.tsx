import React, { createContext, useContext, useState, ReactNode } from 'react';

export type UserRole = 'developer' | 'analyst' | 'business' | 'casual';

interface UserRoleContextType {
  role: UserRole;
  setRole: (role: UserRole) => void;
  getRoleConfig: () => RoleConfig;
}

interface RoleConfig {
  name: string;
  description: string;
  color: string;
  features: string[];
  defaultPrompts: Array<{ name: string; prompt: string; category: string }>;
}

const roleConfigs: Record<UserRole, RoleConfig> = {
  developer: {
    name: 'Developer',
    description: 'Full access to all LLM models and technical features',
    color: 'bg-blue-500',
    features: ['Advanced Settings', 'Code Generation', 'API Access', 'Workflow Builder', 'Debug Tools'],
    defaultPrompts: [
      { name: 'Code Review', prompt: 'Review this code for best practices and potential issues:', category: 'Development' },
      { name: 'Debug Helper', prompt: 'Help me debug this error:', category: 'Development' },
      { name: 'Architecture Design', prompt: 'Design a system architecture for:', category: 'Planning' },
    ],
  },
  analyst: {
    name: 'Data Analyst',
    description: 'Multi-model data analysis and business insights',
    color: 'bg-green-500',
    features: ['Data Visualization', 'Statistical Analysis', 'Report Generation', 'Chart Creation'],
    defaultPrompts: [
      { name: 'Data Summary', prompt: 'Analyze this dataset and provide key insights:', category: 'Analysis' },
      { name: 'Trend Analysis', prompt: 'Identify trends and patterns in:', category: 'Analysis' },
      { name: 'Report Generator', prompt: 'Generate a business report for:', category: 'Reporting' },
    ],
  },
  business: {
    name: 'Business User',
    description: 'Streamlined multi-LLM interface for business tasks',
    color: 'bg-purple-500',
    features: ['Content Creation', 'Document Analysis', 'Meeting Summaries', 'Email Drafting'],
    defaultPrompts: [
      { name: 'Meeting Summary', prompt: 'Summarize the key points from this meeting:', category: 'Business' },
      { name: 'Email Draft', prompt: 'Help me write a professional email about:', category: 'Communication' },
      { name: 'Presentation Outline', prompt: 'Create an outline for a presentation on:', category: 'Business' },
    ],
  },
  casual: {
    name: 'Casual User',
    description: 'Simple access to multiple AI models for everyday tasks',
    color: 'bg-orange-500',
    features: ['Quick Chat', 'Basic Tasks', 'Simple Templates'],
    defaultPrompts: [
      { name: 'General Help', prompt: 'Can you help me with:', category: 'General' },
      { name: 'Explain Simply', prompt: 'Explain in simple terms:', category: 'Learning' },
      { name: 'Quick Question', prompt: 'I have a quick question about:', category: 'General' },
    ],
  },
};

const UserRoleContext = createContext<UserRoleContextType | undefined>(undefined);

export function UserRoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<UserRole>('casual');

  const getRoleConfig = () => roleConfigs[role];

  return (
    <UserRoleContext.Provider value={{ role, setRole, getRoleConfig }}>
      {children}
    </UserRoleContext.Provider>
  );
}

export function useUserRole() {
  const context = useContext(UserRoleContext);
  if (context === undefined) {
    throw new Error('useUserRole must be used within a UserRoleProvider');
  }
  return context;
}