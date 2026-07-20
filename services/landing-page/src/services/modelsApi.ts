import { LLMModel } from '../contexts/LLMContext';

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

  /**
   * Get all models with optional filtering
   */
  async getModels(filters: ModelFilters = {}): Promise<LLMModel[]> {
    try {
      const queryParams = new URLSearchParams();
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, value.toString());
        }
      });

      const url = queryParams.toString() 
        ? `${this.baseUrl}?${queryParams.toString()}`
        : this.baseUrl;

      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }

      const models = await response.json();
      
      // Transform API models to frontend format
      return models.map((model: any) => ({
        id: model.id,
        name: model.name,
        provider: model.provider,
        description: model.description,
        capabilities: model.capabilities,
        maxTokens: model.maxTokens,
        cost: model.cost,
        speed: model.speed,
        quality: model.quality,
      }));
    } catch (error) {
      console.error('Error fetching models:', error);
      throw error;
    }
  }

  /**
   * Get a single model by ID
   */
  async getModelById(modelId: string): Promise<LLMModel | null> {
    try {
      const response = await fetch(`${this.baseUrl}/${modelId}`);
      
      if (response.status === 404) {
        return null;
      }
      
      if (!response.ok) {
        throw new Error(`Failed to fetch model: ${response.statusText}`);
      }

      const model = await response.json();
      
      return {
        id: model.id,
        name: model.name,
        provider: model.provider,
        description: model.description,
        capabilities: model.capabilities,
        maxTokens: model.maxTokens,
        cost: model.cost,
        speed: model.speed,
        quality: model.quality,
      };
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
      const response = await fetch(`${this.baseUrl}/stats`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch model stats: ${response.statusText}`);
      }

      return await response.json();
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
      const response = await fetch(`${this.baseUrl}/providers`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch providers: ${response.statusText}`);
      }

      return await response.json();
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
      const response = await fetch(`${this.baseUrl}/capabilities`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch capabilities: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching capabilities:', error);
      throw error;
    }
  }
}

export const modelsApiService = new ModelsApiService();
