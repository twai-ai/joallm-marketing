import { apiClient } from '../utils/api-client';
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
  user: User;
  token: string;
  message?: string;
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
  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      const response = await apiClient.post<AuthResponse>(
        API_ENDPOINTS.auth.login,
        { email, password }
      );
      return response;
    } catch (error: any) {
      const errorMessage = error.message || 'Login failed. Please check your credentials.';
      showError(errorMessage);
      throw new Error(errorMessage);
    }
  }

  async register(email: string, password: string, name: string): Promise<AuthResponse> {
    try {
      const response = await apiClient.post<AuthResponse>(
        API_ENDPOINTS.auth.register,
        { email, password, name }
      );
      return response;
    } catch (error: any) {
      const errorMessage = error.message || 'Registration failed. Please try again.';
      showError(errorMessage);
      throw new Error(errorMessage);
    }
  }

  async logout(): Promise<void> {
    try {
      await apiClient.post(API_ENDPOINTS.auth.logout);
    } catch (error: any) {
      // Don't show error for logout failures, just log it
      console.error('Logout error:', error);
    }
  }

  async getProfile(): Promise<User> {
    try {
      const response = await apiClient.get<User>(API_ENDPOINTS.auth.profile);
      return response;
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to fetch profile';
      showError(errorMessage);
      throw new Error(errorMessage);
    }
  }

  async updateProfile(updates: UpdateProfileRequest): Promise<User> {
    try {
      const response = await apiClient.put<User>(
        API_ENDPOINTS.auth.profile,
        updates
      );
      return response;
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to update profile';
      showError(errorMessage);
      throw new Error(errorMessage);
    }
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    try {
      await apiClient.put(
        API_ENDPOINTS.auth.changePassword || `${API_ENDPOINTS.auth.profile}/password`,
        { currentPassword, newPassword }
      );
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to change password';
      showError(errorMessage);
      throw new Error(errorMessage);
    }
  }

  async refreshToken(): Promise<{ token: string }> {
    try {
      const response = await apiClient.post<{ token: string }>(
        API_ENDPOINTS.auth.refresh
      );
      return response;
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to refresh token';
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
