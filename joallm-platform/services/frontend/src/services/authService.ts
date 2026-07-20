import { API_ENDPOINTS } from '../config/api';
import { User } from '../contexts/AuthContext';
import { showError } from '../utils/toast';

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

  // Helper method for unauthenticated requests
  private async makeUnauthenticatedRequest<T>(endpoint: string, data: any): Promise<T> {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  // Helper method for authenticated requests
  private async makeAuthenticatedRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const { storage } = await import('../utils/storage');
    const { STORAGE_KEYS } = await import('../utils/storage');
    
    const token = storage.getSecure<string>(STORAGE_KEYS.AUTH_TOKEN);
    
    const response = await fetch(endpoint, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers,
      },
    });

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
      const errorMessage = error.message || 'Login failed. Please check your credentials.';
      showError(errorMessage);
      throw new Error(errorMessage);
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
      const errorMessage = error.message || 'Registration failed. Please try again.';
      showError(errorMessage);
      throw new Error(errorMessage);
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
      const response = await this.makeAuthenticatedRequest<{ user: User } | User>(API_ENDPOINTS.auth.profile);
      return this.normalizeUser(response);
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to fetch profile';
      if (!silent) {
        showError(errorMessage);
      }
      throw new Error(errorMessage);
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

      const response = await fetch(API_ENDPOINTS.auth.refresh, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

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
      const errorMessage = error.message || 'Failed to refresh token';
      if (!silent) {
        showError(errorMessage);
      }
      throw new Error(errorMessage);
    }
  }

  async verifyTwoFactorLogin(code: string, preAuthToken: string): Promise<AuthResponse> {
    try {
      const response = await fetch(API_ENDPOINTS.security.verify2FA, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${preAuthToken}`,
        },
        body: JSON.stringify({ code }),
      });

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
      const errorMessage = error.message || '2FA verification failed';
      showError(errorMessage);
      throw new Error(errorMessage);
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
