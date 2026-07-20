// LocalStorage and SessionStorage utilities with encryption

import CryptoJS from 'crypto-js';

const ENCRYPTION_KEY = 'joallm-secure-key-v1';

// Encrypt sensitive data
function encrypt(data: string): string {
  return CryptoJS.AES.encrypt(data, ENCRYPTION_KEY).toString();
}

// Decrypt sensitive data
function decrypt(data: string): string {
  const bytes = CryptoJS.AES.decrypt(data, ENCRYPTION_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
}

// LocalStorage wrapper
export const storage = {
  // Regular storage
  set<T>(key: string, value: T): void {
    try {
      const serialized = JSON.stringify(value);
      localStorage.setItem(key, serialized);
    } catch (error) {
      console.error(`Error saving to localStorage (${key}):`, error);
    }
  },

  get<T>(key: string, defaultValue?: T): T | null {
    try {
      const item = localStorage.getItem(key);
      if (item === null) return defaultValue ?? null;
      return JSON.parse(item) as T;
    } catch (error) {
      console.error(`Error reading from localStorage (${key}):`, error);
      return defaultValue ?? null;
    }
  },

  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`Error removing from localStorage (${key}):`, error);
    }
  },

  clear(): void {
    try {
      localStorage.clear();
    } catch (error) {
      console.error('Error clearing localStorage:', error);
    }
  },

  // Secure storage with encryption
  setSecure<T>(key: string, value: T): void {
    try {
      const serialized = JSON.stringify(value);
      const encrypted = encrypt(serialized);
      localStorage.setItem(`secure_${key}`, encrypted);
    } catch (error) {
      console.error(`Error saving secure data (${key}):`, error);
    }
  },

  getSecure<T>(key: string, defaultValue?: T): T | null {
    try {
      const encrypted = localStorage.getItem(`secure_${key}`);
      if (encrypted === null) return defaultValue ?? null;
      const decrypted = decrypt(encrypted);
      return JSON.parse(decrypted) as T;
    } catch (error) {
      console.error(`Error reading secure data (${key}):`, error);
      // Clear corrupted data and return default
      localStorage.removeItem(`secure_${key}`);
      return defaultValue ?? null;
    }
  },

  removeSecure(key: string): void {
    try {
      localStorage.removeItem(`secure_${key}`);
    } catch (error) {
      console.error(`Error removing secure data (${key}):`, error);
    }
  },
};

// SessionStorage wrapper
export const sessionStorage = {
  set<T>(key: string, value: T): void {
    try {
      const serialized = JSON.stringify(value);
      window.sessionStorage.setItem(key, serialized);
    } catch (error) {
      console.error(`Error saving to sessionStorage (${key}):`, error);
    }
  },

  get<T>(key: string, defaultValue?: T): T | null {
    try {
      const item = window.sessionStorage.getItem(key);
      if (item === null) return defaultValue ?? null;
      return JSON.parse(item) as T;
    } catch (error) {
      console.error(`Error reading from sessionStorage (${key}):`, error);
      return defaultValue ?? null;
    }
  },

  remove(key: string): void {
    try {
      window.sessionStorage.removeItem(key);
    } catch (error) {
      console.error(`Error removing from sessionStorage (${key}):`, error);
    }
  },

  clear(): void {
    try {
      window.sessionStorage.clear();
    } catch (error) {
      console.error('Error clearing sessionStorage:', error);
    }
  },
};

// Storage keys constants
export const STORAGE_KEYS = {
  // API Keys (encrypted)
  API_KEYS: 'api_keys',
  
  // User preferences
  USER_ROLE: 'user_role',
  THEME: 'theme',
  LANGUAGE: 'language',
  SETTINGS: 'settings',
  
  // UI state
  SIDEBAR_OPEN: 'sidebar_open',
  LAST_VIEW: 'last_view',
  SELECTED_MODEL: 'selected_model',
  
  // Session state
  ACTIVE_CHAT_SESSION: 'active_chat_session',
  DRAFT_MESSAGE: 'draft_message',
  ACTIVE_WORKFLOW: 'active_workflow',
  ACTIVE_NOTEBOOK: 'active_notebook',
  
  // Auth
  AUTH_TOKEN: 'auth_token',
  REFRESH_TOKEN: 'refresh_token',
  USER: 'user',
} as const;


