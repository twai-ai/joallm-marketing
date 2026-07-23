import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService } from '../services/authService';
import { storage, STORAGE_KEYS } from '../utils/storage';
import { isTransientNetworkError } from '../utils/fetchWithTimeout';
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
  organizationId?: string;
  organizationCode?: string;
  organizationSlug?: string;
  membershipId?: string;
  membershipRole?: 'owner' | 'admin' | 'member' | 'viewer';
  permissions?: string[];
  experiences?: string[];
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
  completeTwoFactorLogin: (code: string, preAuthToken: string) => Promise<void>;
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
          const openWithCachedSession = () => {
            // Slow/offline networks: open immediately with cached session
            // instead of hanging on an unbounded profile fetch.
            console.warn('Using cached session after network issue during auth bootstrap');
            setAuthState({
              user,
              token,
              isAuthenticated: true,
              isLoading: false,
            });
          };

          // Verify token is still valid by fetching profile (silently, no error toasts)
          try {
            const profile = await authService.getProfile(true); // silent mode
            setAuthState({
              user: profile,
              token,
              isAuthenticated: true,
              isLoading: false,
            });
          } catch (error) {
            if (isTransientNetworkError(error)) {
              openWithCachedSession();
              return;
            }

            // Token is invalid or expired - try to refresh silently
            console.log('Token validation failed, attempting silent refresh...');
            const refreshToken = storage.getSecure<string>(STORAGE_KEYS.REFRESH_TOKEN);
            
            if (refreshToken) {
              try {
                const response = await authService.refreshToken(true); // silent mode
                storage.setSecure(STORAGE_KEYS.AUTH_TOKEN, response.token);
                
                // Retry getting profile with new token (still silent)
                const profile = await authService.getProfile(true); // silent mode
                setAuthState({
                  user: profile,
                  token: response.token,
                  isAuthenticated: true,
                  isLoading: false,
                });
                console.log('✅ Token refreshed successfully');
                return; // Successfully refreshed, exit early
              } catch (refreshError) {
                if (isTransientNetworkError(refreshError)) {
                  openWithCachedSession();
                  return;
                }
                console.log('Token refresh failed, clearing auth data');
              }
            }
            
            // If refresh failed or no refresh token, clear auth silently (no error toast)
            await clearAuthData();
          }
        } else {
          // Optional development-only bootstrap via explicit env vars
          if (import.meta.env.DEV && import.meta.env.VITE_AUTO_LOGIN === 'true') {
            const devToken = import.meta.env.VITE_DEV_AUTH_TOKEN;
            const devUserJson = import.meta.env.VITE_DEV_AUTH_USER_JSON;

            if (typeof devToken === 'string' && devToken.trim() && typeof devUserJson === 'string' && devUserJson.trim()) {
              try {
                const devUser = JSON.parse(devUserJson) as User;
                storage.setSecure(STORAGE_KEYS.AUTH_TOKEN, devToken);
                storage.setSecure(STORAGE_KEYS.USER, devUser);

                setAuthState({
                  user: devUser,
                  token: devToken,
                  isAuthenticated: true,
                  isLoading: false,
                });
                return;
              } catch (parseError) {
                console.warn('Failed to parse VITE_DEV_AUTH_USER_JSON:', parseError);
              }
            }

            console.warn('VITE_AUTO_LOGIN is enabled but development auth env vars are incomplete');
            setAuthState(prev => ({ ...prev, isLoading: false }));
          } else {
            setAuthState(prev => ({ ...prev, isLoading: false }));
          }
        }
      } catch (error) {
        console.error('Failed to initialize auth:', error);
        // Prefer opening with cached credentials over a blank login wall on transient failures
        const token = storage.getSecure<string>(STORAGE_KEYS.AUTH_TOKEN);
        const user = storage.getSecure<User>(STORAGE_KEYS.USER);
        if (token && user && isTransientNetworkError(error)) {
          setAuthState({
            user,
            token,
            isAuthenticated: true,
            isLoading: false,
          });
          return;
        }
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

  const getDisplayName = (user: User) => user.name?.trim() || user.email?.split('@')[0] || 'User';

  const login = async (email: string, password: string) => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));
      
      const response = await authService.login(email, password);

      if (response.requiresTwoFactor && response.preAuthToken) {
        const twoFactorError = new Error(response.message || 'Two-factor authentication required');
        (twoFactorError as any).requiresTwoFactor = true;
        (twoFactorError as any).preAuthToken = response.preAuthToken;
        throw twoFactorError;
      }

      if (!response.user || !response.token) {
        throw new Error('Login response was incomplete');
      }
      
      // Store auth data securely
      storage.setSecure(STORAGE_KEYS.AUTH_TOKEN, response.token);
      if (response.refreshToken) {
        storage.setSecure(STORAGE_KEYS.REFRESH_TOKEN, response.refreshToken);
      }
      storage.setSecure(STORAGE_KEYS.USER, response.user);
      
      setAuthState({
        user: response.user,
        token: response.token,
        isAuthenticated: true,
        isLoading: false,
      });

      showSuccess(`Welcome back, ${getDisplayName(response.user)}!`);
    } catch (error: any) {
      setAuthState(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  };

  const completeTwoFactorLogin = async (code: string, preAuthToken: string) => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));

      const response = await authService.verifyTwoFactorLogin(code, preAuthToken);
      if (!response.user || !response.token) {
        throw new Error('2FA verification response was incomplete');
      }

      storage.setSecure(STORAGE_KEYS.AUTH_TOKEN, response.token);
      if (response.refreshToken) {
        storage.setSecure(STORAGE_KEYS.REFRESH_TOKEN, response.refreshToken);
      }
      storage.setSecure(STORAGE_KEYS.USER, response.user);

      setAuthState({
        user: response.user,
        token: response.token,
        isAuthenticated: true,
        isLoading: false,
      });

      showSuccess(`Welcome back, ${getDisplayName(response.user)}!`);
    } catch (error) {
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
      if (response.refreshToken) {
        storage.setSecure(STORAGE_KEYS.REFRESH_TOKEN, response.refreshToken);
      }
      storage.setSecure(STORAGE_KEYS.USER, response.user);
      
      setAuthState({
        user: response.user,
        token: response.token,
        isAuthenticated: true,
        isLoading: false,
      });

      showSuccess(`Welcome to ATRISI Marketing, ${getDisplayName(response.user)}!`);
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
    completeTwoFactorLogin,
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
