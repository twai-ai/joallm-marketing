export interface BackendLLMModel {
  id: string;
  name: string;
  provider: string;
  description: string;
  capabilities: string[];
  maxTokens: number;
  cost: string;
  speed: 'fast' | 'medium' | 'slow';
  quality: 'high' | 'medium' | 'low';
  available: boolean;
}

export type LLMModel = Omit<BackendLLMModel, 'available'> & {
  available?: boolean;
};

export const resolveSelectedModel = (
  models: LLMModel[],
  selectedModelId?: string,
  fallbackModel?: LLMModel
): LLMModel => {
  return (
    models.find(model => model.id === selectedModelId) ||
    models[0] ||
    fallbackModel ||
    {
      id: 'llama-3.1-8b-instant',
      name: 'Llama 3.1 8B Instant (Groq)',
      provider: 'Groq',
      description: 'Ultra-fast, cost-effective Groq model',
      capabilities: ['Text', 'Code', 'Analysis'],
      maxTokens: 131072,
      cost: 'Available in backend',
      speed: 'fast',
      quality: 'medium',
      available: true,
    }
  );
};
