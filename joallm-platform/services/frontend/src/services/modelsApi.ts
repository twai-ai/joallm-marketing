import { BackendLLMModel } from '../domain/model';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface ModelFilters {
  provider?: string;
  capability?: string;
  speed?: string;
  quality?: string;
  is_available?: boolean;
  is_featured?: boolean;
  search?: string;
}

export interface ModelStats {
  total: number;
  byProvider: Record<string, number>;
  byCapability: Record<string, number>;
  available: number;
  featured: number;
}

export class ModelsApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = `${API_BASE_URL}/api/models`;
  }

  private async requestJson<T>(path = '', init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, init);

    if (!response.ok) {
      throw new Error(`Request failed: ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Get all models with optional filtering
   */
  async getModels(filters: ModelFilters = {}): Promise<BackendLLMModel[]> {
    try {
      const queryParams = new URLSearchParams();
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, value.toString());
        }
      });

      const query = queryParams.toString();
      return await this.requestJson<BackendLLMModel[]>(query ? `?${query}` : '');
    } catch (error) {
      console.error('Error fetching models:', error);
      throw error;
    }
  }

  /**
   * Get a single model by ID
   */
  async getModelById(modelId: string): Promise<BackendLLMModel | null> {
    try {
      const response = await fetch(`${this.baseUrl}/${modelId}`);
      
      if (response.status === 404) {
        return null;
      }
      
      if (!response.ok) {
        throw new Error(`Failed to fetch model: ${response.statusText}`);
      }

      return (await response.json()) as BackendLLMModel;
    } catch (error) {
      console.error('Error fetching model:', error);
      throw error;
    }
  }

  /**
   * Get model statistics
   */
  async getModelStats(): Promise<ModelStats> {
    try {
      return await this.requestJson<ModelStats>('/stats');
    } catch (error) {
      console.error('Error fetching model stats:', error);
      throw error;
    }
  }

  /**
   * Get available providers
   */
  async getProviders(): Promise<string[]> {
    try {
      return await this.requestJson<string[]>('/providers');
    } catch (error) {
      console.error('Error fetching providers:', error);
      throw error;
    }
  }

  /**
   * Get available capabilities
   */
  async getCapabilities(): Promise<string[]> {
    try {
      return await this.requestJson<string[]>('/capabilities');
    } catch (error) {
      console.error('Error fetching capabilities:', error);
      throw error;
    }
  }
}

export const modelsApiService = new ModelsApiService();
