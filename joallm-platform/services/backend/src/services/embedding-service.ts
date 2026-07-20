import OpenAI from 'openai';
import { CohereClient } from 'cohere-ai';
import { config } from '../config/config.js';
import { logger } from '../utils/logger.js';

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  usage: {
    promptTokens: number;
    totalTokens: number;
  };
}

export class EmbeddingService {
  private openai: OpenAI;
  private cohere: CohereClient;

  constructor(userApiKeys?: { openai?: string; cohere?: string }) {
    this.openai = new OpenAI({
      apiKey: userApiKeys?.openai || config.openaiApiKey,
    });
    this.cohere = new CohereClient({
      token: userApiKeys?.cohere || config.cohereApiKey,
    });
  }

  async generateEmbedding(text: string, userApiKeys?: { openai?: string; cohere?: string }): Promise<EmbeddingResult> {
    // Create a new service instance with user API keys if provided
    if (userApiKeys) {
      const userService = new EmbeddingService(userApiKeys);
      return userService.generateEmbedding(text);
    }
    try {
      logger.info(`Generating embedding for text (${text.length} characters)`);
      
      // Try Cohere first (primary embedding service)
      if (config.cohereApiKey !== 'PLACEHOLDER-COHERE-KEY-NOT-SET') {
        try {
          const response = await this.cohere.embed({
            texts: [text],
            model: 'embed-english-v3.0',
            inputType: 'search_document',
          });

          const embedding = (response.embeddings as number[][])[0];
          
          return {
            embedding: embedding,
            model: 'embed-english-v3.0',
            usage: {
              promptTokens: text.length,
              totalTokens: text.length,
            },
          };
        } catch (cohereError: any) {
          logger.warn('Cohere embedding failed, trying OpenAI:', cohereError.message);
        }
      }
      
      // Fallback to OpenAI if Cohere fails — use text-embedding-3-small with dimensions=1024
      // to match the pgvector column declaration (vector(1024)). text-embedding-ada-002 produces
      // 1536 dimensions which is structurally incompatible with the schema.
      if (config.openaiApiKey !== 'PLACEHOLDER-OPENAI-KEY-NOT-SET') {
        try {
          const response = await this.openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: text,
            dimensions: 1024,
          });

          const embedding = response.data[0];

          return {
            embedding: embedding.embedding,
            model: response.model,
            usage: {
              promptTokens: response.usage.prompt_tokens,
              totalTokens: response.usage.total_tokens,
            },
          };
        } catch (openaiError: any) {
          logger.warn('OpenAI embedding failed:', openaiError.message);
        }
      }
      
      // Final fallback to mock embeddings
      logger.warn('All embedding services failed, using mock embeddings for development');
      return this.generateMockEmbedding(text);
      
    } catch (error: any) {
      logger.error('Failed to generate embedding:', error);
      throw new Error('Embedding generation failed');
    }
  }

  private generateMockEmbedding(text: string): EmbeddingResult {
    // Generate a simple hash-based embedding for development (1024 dimensions to match Cohere)
    const hash = this.simpleHash(text);
    const embedding = new Array(1024).fill(0).map((_, i) => {
      const seed = hash + i;
      return Math.sin(seed) * 0.1; // Small values to simulate real embeddings
    });
    
    return {
      embedding,
      model: 'mock-embedding-v1',
      usage: {
        promptTokens: text.length,
        totalTokens: text.length,
      },
    };
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  async generateEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
    try {
      logger.info(`🔄 Generating embeddings for ${texts.length} texts`);
      
      // Try Cohere first (primary embedding service)
      if (config.cohereApiKey !== 'PLACEHOLDER-COHERE-KEY-NOT-SET') {
        try {
          logger.info(`Using Cohere API for embeddings (model: embed-english-v3.0)`);
          const response = await this.cohere.embed({
            texts: texts,
            model: 'embed-english-v3.0',
            inputType: 'search_document',
          });

          const embeddings = response.embeddings as number[][];
          logger.info(`✓ Cohere embeddings generated successfully: ${embeddings.length} embeddings`);

          return embeddings.map((embedding: number[], index: number) => ({
            embedding: embedding,
            model: 'embed-english-v3.0',
            usage: {
              promptTokens: texts[index].length,
              totalTokens: texts[index].length,
            },
          }));
        } catch (cohereError: any) {
          logger.error('❌ Cohere embeddings failed:', cohereError);
          logger.warn('Trying OpenAI as fallback...');
        }
      } else {
        logger.warn('⚠ Cohere API key not set (PLACEHOLDER), skipping Cohere');
      }
      
      // Fallback to OpenAI if Cohere fails — use text-embedding-3-small with dimensions=1024
      // to match the pgvector column declaration (vector(1024)). text-embedding-ada-002 produces
      // 1536 dimensions which is structurally incompatible with the schema.
      if (config.openaiApiKey !== 'PLACEHOLDER-OPENAI-KEY-NOT-SET') {
        try {
          logger.info(`Using OpenAI API for embeddings (model: text-embedding-3-small, dimensions: 1024)`);
          const response = await this.openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: texts,
            dimensions: 1024,
          });

          logger.info(`✓ OpenAI embeddings generated successfully: ${response.data.length} embeddings`);

          return response.data.map((embedding) => ({
            embedding: embedding.embedding,
            model: response.model,
            usage: {
              promptTokens: response.usage.prompt_tokens,
              totalTokens: response.usage.total_tokens,
            },
          }));
        } catch (openaiError: any) {
          logger.error('❌ OpenAI embeddings failed:', openaiError);
        }
      } else {
        logger.warn('⚠ OpenAI API key not set (PLACEHOLDER), skipping OpenAI');
      }
      
      // Final fallback to mock embeddings
      logger.warn('⚠ All embedding services failed or not configured, using mock embeddings for development');
      logger.warn('⚠ Mock embeddings will NOT work for actual search - please configure Cohere or OpenAI API keys');
      return texts.map(text => this.generateMockEmbedding(text));
      
    } catch (error: any) {
      logger.error('Failed to generate embeddings:', error);
      throw new Error('Embeddings generation failed');
    }
  }

  async generateQueryEmbedding(query: string): Promise<number[]> {
    const result = await this.generateQueryEmbeddingFull(query);
    return result.embedding;
  }

  /** Returns both the embedding vector and the model name used to produce it. */
  async generateQueryEmbeddingFull(query: string): Promise<EmbeddingResult> {
    logger.info(`Generating query embedding for: "${query}"`);
    const result = await this.generateEmbedding(query);
    logger.info(`Generated query embedding with ${result.embedding.length} dimensions using model: ${result.model}`);
    return result;
  }

  // Utility function to calculate cosine similarity
  calculateCosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }
}

export const embeddingService = new EmbeddingService();


