import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService } from '../services/authService';
import { storage, STORAGE_KEYS } from '../utils/storage';
import { showSuccess, showError } from '../utils/toast';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: 'casual' | 'admin' | 'premium' | 'superuser';
  subscriptionTier: 'free' | 'pro' | 'enterprise';
  usageStats?: {
    totalTokens: number;
    totalRequests: number;
    totalFiles: number;
    lastReset: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  refreshToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
  });

  // Initialize auth state from storage on mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const token = storage.getSecure<string>(STORAGE_KEYS.AUTH_TOKEN);
        const user = storage.getSecure<User>(STORAGE_KEYS.USER);

        if (token && user) {
          // Verify token is still valid by fetching profile
          try {
            const profile = await authService.getProfile();
            setAuthState({
              user: profile,
              token,
              isAuthenticated: true,
              isLoading: false,
            });
          } catch (error) {
            // Token is invalid, clear storage
            await clearAuthData();
          }
        } else {
          setAuthState(prev => ({ ...prev, isLoading: false }));
        }
      } catch (error) {
        console.error('Failed to initialize auth:', error);
        await clearAuthData();
      }
    };

    initializeAuth();
  }, []);

  const clearAuthData = async () => {
    storage.removeSecure(STORAGE_KEYS.AUTH_TOKEN);
    storage.removeSecure(STORAGE_KEYS.REFRESH_TOKEN);
    storage.removeSecure(STORAGE_KEYS.USER);
    setAuthState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
    });
  };

  const login = async (email: string, password: string) => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));
      
      const response = await authService.login(email, password);
      
      // Store auth data securely
      storage.setSecure(STORAGE_KEYS.AUTH_TOKEN, response.token);
      storage.setSecure(STORAGE_KEYS.USER, response.user);
      
      setAuthState({
        user: response.user,
        token: response.token,
        isAuthenticated: true,
        isLoading: false,
      });

      showSuccess(`Welcome back, ${response.user.name}!`);
    } catch (error: any) {
      setAuthState(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  };

  const register = async (email: string, password: string, name: string) => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));
      
      const response = await authService.register(email, password, name);
      
      // Store auth data securely
      storage.setSecure(STORAGE_KEYS.AUTH_TOKEN, response.token);
      storage.setSecure(STORAGE_KEYS.USER, response.user);
      
      setAuthState({
        user: response.user,
        token: response.token,
        isAuthenticated: true,
        isLoading: false,
      });

      showSuccess(`Welcome to JoaLLM, ${response.user.name}!`);
    } catch (error: any) {
      setAuthState(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  };

  const logout = async () => {
    try {
      if (authState.token) {
        await authService.logout();
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      await clearAuthData();
      showSuccess('You have been logged out successfully');
    }
  };

  const updateProfile = async (updates: Partial<User>) => {
    const updatedUser = await authService.updateProfile(updates);

    // Update stored user data
    storage.setSecure(STORAGE_KEYS.USER, updatedUser);

    setAuthState(prev => ({
      ...prev,
      user: updatedUser,
    }));

    showSuccess('Profile updated successfully');
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    await authService.changePassword(currentPassword, newPassword);
    showSuccess('Password changed successfully');
  };

  const refreshToken = async () => {
    try {
      const response = await authService.refreshToken();
      
      // Update stored token
      storage.setSecure(STORAGE_KEYS.AUTH_TOKEN, response.token);
      
      setAuthState(prev => ({
        ...prev,
        token: response.token,
      }));
    } catch (error) {
      // Refresh failed, logout user
      await clearAuthData();
      throw error;
    }
  };

  const value: AuthContextType = {
    ...authState,
    login,
    register,
    logout,
    updateProfile,
    changePassword,
    refreshToken,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
