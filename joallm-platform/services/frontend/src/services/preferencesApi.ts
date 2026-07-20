import { apiClient } from '../utils/api-client';
import type { WorkspaceMode } from '../types';
import type { MultimodalSettings } from '../constants/modalities';

export interface UserPreferences {
  id: string;
  userId: string;
  theme: 'light' | 'dark' | 'auto';
  fontSize: 'small' | 'medium' | 'large';
  compactMode: boolean;
  emailNotifications: boolean;
  pushNotifications: boolean;
  notificationFrequency: 'immediate' | 'hourly' | 'daily' | 'weekly';
  analyticsEnabled: boolean;
  errorReporting: boolean;
  autoSave: boolean;
  streamingEnabled: boolean;
  keyboardShortcutsEnabled: boolean;
  customShortcuts: Record<string, any>;
  defaultModel?: string;
  defaultTemperature: number;
  defaultMaxTokens: number;
  workspaceMode?: WorkspaceMode;
  multimodalSettings?: MultimodalSettings;
  createdAt: string;
  updatedAt: string;
}

export const preferencesApi = {
  // Get preferences
  async getPreferences(): Promise<UserPreferences> {
    const response = await apiClient.get('/api/preferences');
    return response.preferences;
  },

  // Update preferences
  async updatePreferences(data: Partial<UserPreferences>): Promise<UserPreferences> {
    const response = await apiClient.put('/api/preferences', data);
    return response.preferences;
  },

  // Update theme only
  async updateTheme(theme: 'light' | 'dark' | 'auto'): Promise<string> {
    const response = await apiClient.patch('/api/preferences/theme', { theme });
    return response.theme;
  },

  // Update keyboard shortcuts
  async updateShortcuts(customShortcuts: Record<string, any>): Promise<Record<string, any>> {
    const response = await apiClient.patch('/api/preferences/shortcuts', { customShortcuts });
    return response.customShortcuts;
  },

  // Reset to defaults
  async resetPreferences(): Promise<void> {
    await apiClient.post('/api/preferences/reset', {});
  },
};
