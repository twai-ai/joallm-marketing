// API client with error handling, retry logic, and authentication
import { APIError } from '../types';
import { storage, STORAGE_KEYS } from './storage';
import { showError } from './toast';

interface RequestConfig extends RequestInit {
  retries?: number;
  retryDelay?: number;
  showErrorToast?: boolean;
}

class APIClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private async getAuthToken(): Promise<string | null> {
    try {
      const token = storage.getSecure<string>(STORAGE_KEYS.AUTH_TOKEN);
      if (!token || token.trim() === '') {
        // Optional development-only bootstrap via explicit env var
        if (import.meta.env.DEV && import.meta.env.VITE_AUTO_LOGIN === 'true') {
          const devToken = import.meta.env.VITE_DEV_AUTH_TOKEN;
          if (typeof devToken === 'string' && devToken.trim().length > 0) {
            console.log('🔧 Development mode: using VITE_DEV_AUTH_TOKEN');
            storage.setSecure(STORAGE_KEYS.AUTH_TOKEN, devToken);
            return devToken;
          }
          console.warn('VITE_AUTO_LOGIN is enabled but VITE_DEV_AUTH_TOKEN is not set');
        }
        console.warn('No valid auth token found, proceeding without authentication');
        return null;
      }
      return token;
    } catch (error) {
      console.warn('Failed to retrieve auth token:', error);
      return null;
    }
  }

  private getHeaders(customHeaders?: HeadersInit): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...customHeaders,
    };

    return headers;
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      let errorMessage = `HTTP error! status: ${response.status}`;
      let errorDetails: any = null;

      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.error || errorMessage;
        errorDetails = errorData;
      } catch {
        // If response is not JSON, use text
        try {
          errorMessage = await response.text();
        } catch {
          // Fallback to status text
          errorMessage = response.statusText || errorMessage;
        }
      }

      if (
        response.status === 403 &&
        typeof errorMessage === 'string' &&
        errorDetails?.error !== 'Workflow limit reached' &&
        (
          errorMessage.includes('Permission') ||
          errorMessage.includes('upgrade') ||
          errorMessage.includes('not available') ||
          errorDetails?.upgradeRequired === true ||
          errorDetails?.error === 'Subscription upgrade required' ||
          errorDetails?.error === 'Feature not available'
        )
      ) {
        errorMessage = 'Upgrade to Pro to use this feature.';
      }

      const error: APIError = {
        message: errorMessage,
        status: response.status,
        code: errorDetails?.code,
        details: errorDetails,
      };

      throw error;
    }

    // Handle empty responses (204 No Content)
    if (response.status === 204) {
      return {} as T;
    }

    try {
      return await response.json();
    } catch {
      return {} as T;
    }
  }

  private async retryRequest<T>(
    url: string,
    config: RequestConfig,
    retries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    try {
      const response = await fetch(url, config);
      return await this.handleResponse<T>(response);
    } catch (error) {
      if (retries > 0 && this.isRetriableError(error)) {
        await this.sleep(delay);
        return this.retryRequest<T>(url, config, retries - 1, delay * 2);
      }
      throw error;
    }
  }

  private isRetriableError(error: any): boolean {
    // Retry on network errors or 5xx server errors
    if (error instanceof TypeError) return true; // Network error
    if (error.status && error.status >= 500 && error.status < 600) return true;
    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private formatErrorDetails(details: unknown): string | undefined {
    if (details == null) {
      return undefined;
    }
    if (typeof details === 'string') {
      return details;
    }
    if (typeof details === 'object') {
      const candidate = details as Record<string, unknown>;
      if (typeof candidate.message === 'string') {
        return candidate.message;
      }
      if (typeof candidate.error === 'string') {
        return candidate.error;
      }
      try {
        return JSON.stringify(details);
      } catch {
        return undefined;
      }
    }
    return String(details);
  }

  async request<T>(
    endpoint: string,
    config: RequestConfig = {}
  ): Promise<T> {
    const {
      retries = 2,
      retryDelay = 1000,
      showErrorToast = true,
      ...fetchConfig
    } = config;

    const url = endpoint.startsWith('http') ? endpoint : `${this.baseURL}${endpoint}`;
    
    // Add auth token if available
    const token = await this.getAuthToken();
    const headers = this.getHeaders(config.headers);
    if (token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    } else {
      // For endpoints that don't require auth, continue without token
      console.debug(`No auth token available for ${endpoint}, proceeding without authentication`);
    }

    try {
      return await this.retryRequest<T>(
        url,
        { ...fetchConfig, headers },
        retries,
        retryDelay
      );
    } catch (error) {
      if (showErrorToast && error instanceof Object && 'message' in error) {
        showError(
          error.message as string,
          error instanceof Object && 'details' in error ? this.formatErrorDetails(error.details) : undefined
        );
      }
      throw error;
    }
  }

  async get<T>(endpoint: string, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, { ...config, method: 'GET' });
  }

  async post<T>(endpoint: string, data: any = {}, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, {
      ...config,
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async put<T>(endpoint: string, data?: any, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, {
      ...config,
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async patch<T>(endpoint: string, data?: any, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, {
      ...config,
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async delete<T>(endpoint: string, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, { ...config, method: 'DELETE' });
  }

  async uploadFile<T>(endpoint: string, file: File, additionalData?: Record<string, any>): Promise<T> {
    const formData = new FormData();
    formData.append('file', file);
    
    if (additionalData) {
      Object.entries(additionalData).forEach(([key, value]) => {
        formData.append(key, String(value));
      });
    }

    const token = await this.getAuthToken();
    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    // Note: We intentionally don't set Content-Type for file uploads
    // The browser will set it automatically with the proper boundary for multipart/form-data

    const url = endpoint.startsWith('http') ? endpoint : `${this.baseURL}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
        headers,
      });
      return await this.handleResponse<T>(response);
    } catch (error) {
      if (error instanceof Object && 'message' in error) {
        showError(
          error.message as string,
          error instanceof Object && 'details' in error ? this.formatErrorDetails(error.details) : undefined
        );
      }
      throw error;
    }
  }
}

// Export singleton instance
import { API_BASE_URL } from '../config/api';
export const apiClient = new APIClient(API_BASE_URL);
