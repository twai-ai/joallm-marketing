/**
 * Cost Calculator Utility
 * 
 * Calculates the cost of API usage for different LLM providers
 * Costs are stored in cents to avoid floating-point precision issues
 */

interface ModelPricing {
  input: number;  // Cost per 1K tokens (in cents)
  output: number; // Cost per 1K tokens (in cents)
}

// Pricing data from seed-models.sql and provider documentation
// Costs converted to cents for precision
const MODEL_PRICING: Record<string, ModelPricing> = {
  // OpenAI Models
  'gpt-4-turbo': { input: 1, output: 3 }, // $0.01/1K in, $0.03/1K out
  'gpt-4': { input: 3, output: 6 }, // $0.03/1K in, $0.06/1K out
  'gpt-3.5-turbo': { input: 0.05, output: 0.15 }, // $0.0005/1K in, $0.0015/1K out
  
  // Anthropic Models
  'claude-3-sonnet': { input: 0.3, output: 0.3 }, // $0.003/1K tokens
  
  // Groq Models - Llama 3.3 Series
  'llama-3.3-70b-versatile': { input: 0.059, output: 0.079 }, // $0.59/1M in, $0.79/1M out
  
  // Groq Models - Llama 4 / current vision
  'meta-llama/llama-4-scout-17b-16e-instruct': { input: 0.011, output: 0.034 }, // $0.11/1M in, $0.34/1M out
  'meta-llama/llama-4-maverick-17b-128e-instruct': { input: 0.020, output: 0.060 }, // deprecated on Groq
  'qwen/qwen3.6-27b': { input: 0.015, output: 0.045 },
  
  // Groq Models - Llama 3.1 Series
  'llama-3.1-8b-instant': { input: 0.005, output: 0.008 }, // $0.05/1M in, $0.08/1M out
  
  // Groq Models - OpenAI Open Models
  'openai/gpt-oss-120b': { input: 0.015, output: 0.060 }, // $0.15/1M in, $0.60/1M out
  'openai/gpt-oss-20b': { input: 0.0075, output: 0.030 }, // $0.075/1M in, $0.30/1M out
  
  // Groq Models - Other
  'qwen/qwen3-32b': { input: 0.029, output: 0.059 }, // $0.29/1M in, $0.59/1M out
  'moonshotai/kimi-k2-instruct-0905': { input: 0.100, output: 0.300 }, // $1.00/1M in, $3.00/1M out
  'moonshotai/kimi-k2-instruct': { input: 0.080, output: 0.240 }, // $0.80/1M in, $2.40/1M out
  'mixtral-8x7b-32768': { input: 0.024, output: 0.024 }, // $0.24/1M tokens
  'gemma2-9b-it': { input: 0.020, output: 0.020 }, // $0.20/1M tokens
  
  // Groq Models - Whisper (Speech-to-Text)
  'whisper-large-v3': { input: 0.0006, output: 0.0006 }, // $0.006/1K tokens
  'whisper-large-v3-turbo': { input: 0.0006, output: 0.0006 }, // $0.006/1K tokens
  
  // Groq Models - Llama Guard
  'meta-llama/llama-guard-4-12b': { input: 0.020, output: 0.020 }, // $0.20/1M tokens
  'meta-llama/llama-prompt-guard-2-22m': { input: 0.010, output: 0.010 }, // $0.10/1M tokens
  'meta-llama/llama-prompt-guard-2-86m': { input: 0.015, output: 0.015 }, // $0.15/1M tokens
  
  // Groq Models - SDAIA
  'allam-2-7b': { input: 0.015, output: 0.015 }, // $0.15/1M tokens
  
  // Ollama Models (Local - Free)
  'llama2:7b': { input: 0, output: 0 },
  'llama2:13b': { input: 0, output: 0 },
  'mistral:7b': { input: 0, output: 0 },
  'codellama:7b': { input: 0, output: 0 },
  'phi:latest': { input: 0, output: 0 },
  
  // Groq Compound Systems (Contact for pricing - estimate $0)
  'groq/compound': { input: 0, output: 0 },
  'groq/compound-mini': { input: 0, output: 0 },
  
  // PlayAI TTS (Contact for pricing - estimate $0)
  'playai-tts': { input: 0, output: 0 },
  'playai-tts-arabic': { input: 0, output: 0 },
};

interface Usage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

/**
 * Calculate the cost of API usage
 * 
 * @param model - The model identifier
 * @param usage - Usage statistics from the LLM provider
 * @returns Cost in whole cents (1 cent = $0.01)
 */
export function calculateCost(model: string, usage: Usage): number {
  const pricing = MODEL_PRICING[model];
  
  // If model not found in pricing table or has zero cost
  if (!pricing || (pricing.input === 0 && pricing.output === 0)) {
    return 0;
  }
  
  // Extract token counts (with fallbacks)
  const promptTokens = usage.promptTokens || 0;
  const completionTokens = usage.completionTokens || 0;
  
  // Calculate costs (per 1K tokens)
  const inputCost = (promptTokens / 1000) * pricing.input;
  const outputCost = (completionTokens / 1000) * pricing.output;
  
  // The database stores integer cents, so round up any non-zero fractional
  // value to the nearest cent before persisting.
  const totalCost = inputCost + outputCost;
  return totalCost > 0 ? Math.ceil(totalCost) : 0;
}

/**
 * Get pricing information for a model
 * 
 * @param model - The model identifier
 * @returns Pricing information or null if not found
 */
export function getModelPricing(model: string): ModelPricing | null {
  return MODEL_PRICING[model] || null;
}

/**
 * Format cost in cents to dollar string
 * 
 * @param cents - Cost in cents
 * @returns Formatted string like "$0.05" or "$1.23"
 */
export function formatCost(cents: number): string {
  const dollars = cents / 100;
  return `$${dollars.toFixed(2)}`;
}

/**
 * Calculate estimated cost for a given model and token count
 * Useful for showing users estimated costs before making a request
 * 
 * @param model - The model identifier
 * @param estimatedInputTokens - Estimated input tokens
 * @param estimatedOutputTokens - Estimated output tokens
 * @returns Estimated cost in cents
 */
export function estimateCost(
  model: string,
  estimatedInputTokens: number,
  estimatedOutputTokens: number
): number {
  return calculateCost(model, {
    promptTokens: estimatedInputTokens,
    completionTokens: estimatedOutputTokens,
  });
}
