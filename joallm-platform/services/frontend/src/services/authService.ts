import { API_ENDPOINTS } from '../config/api';
import { User } from '../contexts/AuthContext';
import { fetchWithTimeout, isTimeoutError, TimeoutError } from '../utils/fetchWithTimeout';
import { showError } from '../utils/toast';

/** Keep auth bootstrap snappy on slow networks; login can wait a bit longer. */
const AUTH_BOOTSTRAP_TIMEOUT_MS = 10_000;
const AUTH_REQUEST_TIMEOUT_MS = 20_000;

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface AuthResponse {
  user?: User;
  token?: string;
  accessToken?: string;
  refreshToken?: string;
  message?: string;
  requiresTwoFactor?: boolean;
  preAuthToken?: string;
}

export interface UpdateProfileRequest {
  name?: string;
  avatar?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export class AuthService {
  private normalizeUser(payload: any): User {
    const user = payload?.user ?? payload;
    return user as User;
  }

  private rethrowPreservingTimeout(error: unknown, fallbackMessage: string): never {
    if (isTimeoutError(error)) {
      throw error instanceof TimeoutError
        ? error
        : new TimeoutError(error instanceof Error ? error.message : fallbackMessage);
    }
    const message = error instanceof Error ? error.message : fallbackMessage;
    throw new Error(message || fallbackMessage);
  }

  // Helper method for unauthenticated requests
  private async makeUnauthenticatedRequest<T>(
    endpoint: string,
    data: any,
    timeoutMs: number = AUTH_REQUEST_TIMEOUT_MS
  ): Promise<T> {
    const response = await fetchWithTimeout(
      endpoint,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      },
      timeoutMs
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  // Helper method for authenticated requests
  private async makeAuthenticatedRequest<T>(
    endpoint: string,
    options: RequestInit = {},
    timeoutMs: number = AUTH_REQUEST_TIMEOUT_MS
  ): Promise<T> {
    const { storage } = await import('../utils/storage');
    const { STORAGE_KEYS } = await import('../utils/storage');
    
    const token = storage.getSecure<string>(STORAGE_KEYS.AUTH_TOKEN);
    
    const response = await fetchWithTimeout(
      endpoint,
      {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
          ...options.headers,
        },
      },
      timeoutMs
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      const response = await this.makeUnauthenticatedRequest<any>(
        API_ENDPOINTS.auth.login,
        { email, password }
      );

      if (response.requiresTwoFactor) {
        return {
          requiresTwoFactor: true,
          preAuthToken: response.preAuthToken,
          message: response.message,
        };
      }
      
      // Handle backend response format (accessToken instead of token)
      return {
        user: this.normalizeUser(response),
        token: response.accessToken || response.token,
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
        message: response.message,
        requiresTwoFactor: response.requiresTwoFactor,
        preAuthToken: response.preAuthToken,
      };
    } catch (error: any) {
      const errorMessage = isTimeoutError(error)
        ? 'Login timed out. Check your connection and try again.'
        : error.message || 'Login failed. Please check your credentials.';
      showError(errorMessage);
      this.rethrowPreservingTimeout(error, errorMessage);
    }
  }

  async register(email: string, password: string, name: string): Promise<AuthResponse> {
    try {
      const response = await this.makeUnauthenticatedRequest<any>(
        API_ENDPOINTS.auth.register,
        { email, password, name }
      );
      
      // Handle backend response format (accessToken instead of token)
      return {
        user: this.normalizeUser(response),
        token: response.accessToken || response.token,
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
        message: response.message
      };
    } catch (error: any) {
      const errorMessage = isTimeoutError(error)
        ? 'Registration timed out. Check your connection and try again.'
        : error.message || 'Registration failed. Please try again.';
      showError(errorMessage);
      this.rethrowPreservingTimeout(error, errorMessage);
    }
  }

  async logout(): Promise<void> {
    try {
      await this.makeAuthenticatedRequest(API_ENDPOINTS.auth.logout, { method: 'POST' });
    } catch (error: any) {
      // Don't show error for logout failures, just log it
      console.error('Logout error:', error);
    }
  }

  async getProfile(silent: boolean = false): Promise<User> {
    try {
      const response = await this.makeAuthenticatedRequest<{ user: User } | User>(
        API_ENDPOINTS.auth.profile,
        {},
        AUTH_BOOTSTRAP_TIMEOUT_MS
      );
      return this.normalizeUser(response);
    } catch (error: any) {
      const errorMessage = isTimeoutError(error)
        ? 'Profile request timed out'
        : error.message || 'Failed to fetch profile';
      if (!silent) {
        showError(errorMessage);
      }
      this.rethrowPreservingTimeout(error, errorMessage);
    }
  }

  async updateProfile(updates: UpdateProfileRequest): Promise<User> {
    try {
      const response = await this.makeAuthenticatedRequest<{ user: User } | User>(
        API_ENDPOINTS.auth.profile,
        { method: 'PUT', body: JSON.stringify(updates) }
      );
      return this.normalizeUser(response);
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to update profile';
      showError(errorMessage);
      throw new Error(errorMessage);
    }
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    try {
      await this.makeAuthenticatedRequest(
        API_ENDPOINTS.auth.changePassword || `${API_ENDPOINTS.auth.profile}/password`,
        { 
          method: 'PUT', 
          body: JSON.stringify({ currentPassword, newPassword }) 
        }
      );
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to change password';
      showError(errorMessage);
      throw new Error(errorMessage);
    }
  }

  async refreshToken(silent: boolean = false): Promise<{ token: string }> {
    try {
      const { storage, STORAGE_KEYS } = await import('../utils/storage');
      const refreshToken = storage.getSecure<string>(STORAGE_KEYS.REFRESH_TOKEN);

      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await fetchWithTimeout(
        API_ENDPOINTS.auth.refresh,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        },
        AUTH_BOOTSTRAP_TIMEOUT_MS
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      // Backend returns { accessToken }, normalize to { token } for callers
      const token = data.accessToken || data.token;
      if (!token) {
        throw new Error('No token in refresh response');
      }
      return { token };
    } catch (error: any) {
      const errorMessage = isTimeoutError(error)
        ? 'Session refresh timed out'
        : error.message || 'Failed to refresh token';
      if (!silent) {
        showError(errorMessage);
      }
      this.rethrowPreservingTimeout(error, errorMessage);
    }
  }

  async verifyTwoFactorLogin(code: string, preAuthToken: string): Promise<AuthResponse> {
    try {
      const response = await fetchWithTimeout(
        API_ENDPOINTS.security.verify2FA,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${preAuthToken}`,
          },
          body: JSON.stringify({ code }),
        },
        AUTH_REQUEST_TIMEOUT_MS
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || `HTTP error! status: ${response.status}`);
      }

      const payload = await response.json();
      return {
        user: this.normalizeUser(payload),
        token: payload.accessToken || payload.token,
        accessToken: payload.accessToken,
        refreshToken: payload.refreshToken,
        message: payload.message,
      };
    } catch (error: any) {
      const errorMessage = isTimeoutError(error)
        ? '2FA verification timed out. Check your connection and try again.'
        : error.message || '2FA verification failed';
      showError(errorMessage);
      this.rethrowPreservingTimeout(error, errorMessage);
    }
  }

  // Utility method to check if user has specific role
  hasRole(user: User | null, role: 'casual' | 'admin' | 'premium' | 'superuser'): boolean {
    if (!user) return false;
    return user.role === role;
  }

  // Utility method to check if user has specific subscription tier
  hasSubscriptionTier(user: User | null, tier: 'free' | 'pro' | 'enterprise'): boolean {
    if (!user) return false;
    return user.subscriptionTier === tier;
  }

  // Utility method to check if user can access premium features
  canAccessPremium(user: User | null): boolean {
    if (!user) return false;
    return user.subscriptionTier === 'pro' || user.subscriptionTier === 'enterprise';
  }

  // Utility method to check if user is admin
  isAdmin(user: User | null): boolean {
    return this.hasRole(user, 'admin');
  }
}

export const authService = new AuthService();
