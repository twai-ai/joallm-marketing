import { db, client } from '../database/connection.js';
import { models } from '../database/schema.js';
import { eq, and, or, ilike, sql } from 'drizzle-orm';
import { logger } from '../utils/logger.js';

export interface Model {
  id: string;
  model_id: string;
  name: string;
  provider: string;
  description: string;
  capabilities: string[];
  max_tokens: number;
  cost: string;
  speed: 'fast' | 'medium' | 'slow';
  quality: 'high' | 'medium' | 'low';
  is_available: boolean;
  is_featured: boolean;
  sort_order: number;
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface CreateModelData {
  model_id: string;
  name: string;
  provider: string;
  description: string;
  capabilities: string[];
  max_tokens: number;
  cost: string;
  speed: 'fast' | 'medium' | 'slow';
  quality: 'high' | 'medium' | 'low';
  is_available?: boolean;
  is_featured?: boolean;
  sort_order?: number;
  metadata?: Record<string, any>;
}

export interface UpdateModelData {
  name?: string;
  provider?: string;
  description?: string;
  capabilities?: string[];
  max_tokens?: number;
  cost?: string;
  speed?: 'fast' | 'medium' | 'slow';
  quality?: 'high' | 'medium' | 'low';
  is_available?: boolean;
  is_featured?: boolean;
  sort_order?: number;
  metadata?: Record<string, any>;
}

export interface ModelFilters {
  provider?: string;
  capability?: string;
  speed?: string;
  quality?: string;
  is_available?: boolean;
  is_featured?: boolean;
  search?: string;
}

export class ModelsService {
  /**
   * Get all models with optional filtering
   */
  async getAllModels(filters: ModelFilters = {}): Promise<Model[]> {
    try {
      const conditions = [];

      // Apply filters
      if (filters.provider) {
        conditions.push(eq(models.provider, filters.provider));
      }

      if (filters.capability) {
        conditions.push(sql`${models.capabilities} @> ${JSON.stringify([filters.capability])}`);
      }

      if (filters.speed) {
        conditions.push(eq(models.speed, filters.speed as 'fast' | 'medium' | 'slow'));
      }

      if (filters.quality) {
        conditions.push(eq(models.quality, filters.quality as 'high' | 'medium' | 'low'));
      }

      if (filters.is_available !== undefined) {
        conditions.push(eq(models.isAvailable, filters.is_available));
      }

      if (filters.is_featured !== undefined) {
        conditions.push(eq(models.isFeatured, filters.is_featured));
      }

      if (filters.search) {
        const searchPattern = `%${filters.search}%`;
        conditions.push(
          or(
            ilike(models.name, searchPattern),
            ilike(models.description, searchPattern),
            sql`EXISTS (
              SELECT 1 FROM jsonb_array_elements_text(${models.capabilities}) AS cap 
              WHERE cap ILIKE ${searchPattern}
            )`
          )
        );
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const result = await db
        .select()
        .from(models)
        .where(whereClause)
        .orderBy(models.sortOrder, models.name);
      
      return result.map(row => ({
        id: row.id,
        model_id: row.modelId,
        name: row.name,
        provider: row.provider,
        description: row.description,
        capabilities: row.capabilities,
        max_tokens: row.maxTokens,
        cost: row.cost,
        speed: row.speed,
        quality: row.quality,
        is_available: row.isAvailable ?? false,
        is_featured: row.isFeatured ?? false,
        sort_order: row.sortOrder ?? 0,
        metadata: row.metadata ?? {},
        created_at: row.createdAt,
        updated_at: row.updatedAt,
      }));
    } catch (error) {
      logger.error('Error fetching models:', error);
      throw new Error('Failed to fetch models');
    }
  }

  /**
   * Get a single model by model_id
   */
  async getModelById(modelId: string): Promise<Model | null> {
    try {
      const result = await db
        .select()
        .from(models)
        .where(eq(models.modelId, modelId))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      const row = result[0];
      return {
        id: row.id,
        model_id: row.modelId,
        name: row.name,
        provider: row.provider,
        description: row.description,
        capabilities: row.capabilities,
        max_tokens: row.maxTokens,
        cost: row.cost,
        speed: row.speed,
        quality: row.quality,
        is_available: row.isAvailable ?? false,
        is_featured: row.isFeatured ?? false,
        sort_order: row.sortOrder ?? 0,
        metadata: row.metadata ?? {},
        created_at: row.createdAt,
        updated_at: row.updatedAt,
      };
    } catch (error) {
      logger.error('Error fetching model by ID:', error);
      throw new Error('Failed to fetch model');
    }
  }

  /**
   * Create a new model
   */
  async createModel(data: CreateModelData): Promise<Model> {
    try {
      const result = await db
        .insert(models)
        .values({
          modelId: data.model_id,
          name: data.name,
          provider: data.provider,
          description: data.description,
          capabilities: data.capabilities,
          maxTokens: data.max_tokens,
          cost: data.cost,
          speed: data.speed,
          quality: data.quality,
          isAvailable: data.is_available ?? true,
          isFeatured: data.is_featured ?? false,
          sortOrder: data.sort_order ?? 0,
          metadata: data.metadata || {},
        })
        .returning();

      const row = result[0];
      return {
        id: row.id,
        model_id: row.modelId,
        name: row.name,
        provider: row.provider,
        description: row.description,
        capabilities: row.capabilities,
        max_tokens: row.maxTokens,
        cost: row.cost,
        speed: row.speed,
        quality: row.quality,
        is_available: row.isAvailable ?? false,
        is_featured: row.isFeatured ?? false,
        sort_order: row.sortOrder ?? 0,
        metadata: row.metadata ?? {},
        created_at: row.createdAt,
        updated_at: row.updatedAt,
      };
    } catch (error) {
      logger.error('Error creating model:', error);
      throw new Error('Failed to create model');
    }
  }

  /**
   * Update a model
   */
  async updateModel(modelId: string, data: UpdateModelData): Promise<Model | null> {
    try {
      const updateData: any = {};

      // Map the update data to the correct field names
      if (data.name !== undefined) updateData.name = data.name;
      if (data.provider !== undefined) updateData.provider = data.provider;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.capabilities !== undefined) updateData.capabilities = data.capabilities;
      if (data.max_tokens !== undefined) updateData.maxTokens = data.max_tokens;
      if (data.cost !== undefined) updateData.cost = data.cost;
      if (data.speed !== undefined) updateData.speed = data.speed;
      if (data.quality !== undefined) updateData.quality = data.quality;
      if (data.is_available !== undefined) updateData.isAvailable = data.is_available;
      if (data.is_featured !== undefined) updateData.isFeatured = data.is_featured;
      if (data.sort_order !== undefined) updateData.sortOrder = data.sort_order;
      if (data.metadata !== undefined) updateData.metadata = data.metadata;

      if (Object.keys(updateData).length === 0) {
        throw new Error('No fields to update');
      }

      const result = await db
        .update(models)
        .set(updateData)
        .where(eq(models.modelId, modelId))
        .returning();

      if (result.length === 0) {
        return null;
      }

      const row = result[0];
      return {
        id: row.id,
        model_id: row.modelId,
        name: row.name,
        provider: row.provider,
        description: row.description,
        capabilities: row.capabilities,
        max_tokens: row.maxTokens,
        cost: row.cost,
        speed: row.speed,
        quality: row.quality,
        is_available: row.isAvailable ?? false,
        is_featured: row.isFeatured ?? false,
        sort_order: row.sortOrder ?? 0,
        metadata: row.metadata ?? {},
        created_at: row.createdAt,
        updated_at: row.updatedAt,
      };
    } catch (error) {
      logger.error('Error updating model:', error);
      throw new Error('Failed to update model');
    }
  }

  /**
   * Delete a model
   */
  async deleteModel(modelId: string): Promise<boolean> {
    try {
      const result = await db
        .delete(models)
        .where(eq(models.modelId, modelId));

      return (result as any).rowCount > 0;
    } catch (error) {
      logger.error('Error deleting model:', error);
      throw new Error('Failed to delete model');
    }
  }

  /**
   * Get available providers
   */
  async getProviders(): Promise<string[]> {
    try {
      const result = await db
        .selectDistinct({ provider: models.provider })
        .from(models)
        .where(eq(models.isAvailable, true))
        .orderBy(models.provider);

      return result.map(row => row.provider);
    } catch (error) {
      logger.error('Error fetching providers:', error);
      throw new Error('Failed to fetch providers');
    }
  }

  /**
   * Get available capabilities
   */
  async getCapabilities(): Promise<string[]> {
    try {
      const result = await client`
        SELECT DISTINCT capability
        FROM models,
        LATERAL jsonb_array_elements_text(capabilities) AS capability
        WHERE is_available = true
        ORDER BY capability
      `;

      return result.map((row: any) => row.capability);
    } catch (error) {
      logger.error('Error fetching capabilities:', error);
      throw new Error('Failed to fetch capabilities');
    }
  }

  /**
   * Get model statistics
   */
  async getModelStats(): Promise<{
    total: number;
    byProvider: Record<string, number>;
    byCapability: Record<string, number>;
    available: number;
    featured: number;
  }> {
    try {
      // Total models
      const totalResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(models);
      const total = totalResult[0].count;

      // Available models
      const availableResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(models)
        .where(eq(models.isAvailable, true));
      const available = availableResult[0].count;

      // Featured models
      const featuredResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(models)
        .where(eq(models.isFeatured, true));
      const featured = featuredResult[0].count;

      // By provider
      const providerResult = await client`
        SELECT provider, count(*) as count
        FROM models
        WHERE is_available = true
        GROUP BY provider
        ORDER BY provider
      `;
      
      const byProvider = providerResult.reduce((acc: Record<string, number>, row: any) => {
        acc[row.provider] = parseInt(row.count);
        return acc;
      }, {} as Record<string, number>);

      // By capability
      const capabilityResult = await client`
        SELECT capability, count(*) as count
        FROM models,
        LATERAL jsonb_array_elements_text(capabilities) AS capability
        WHERE is_available = true
        GROUP BY capability
        ORDER BY capability
      `;
      
      const byCapability = capabilityResult.reduce((acc: Record<string, number>, row: any) => {
        acc[row.capability] = parseInt(row.count);
        return acc;
      }, {} as Record<string, number>);

      return {
        total,
        byProvider,
        byCapability,
        available,
        featured
      };
    } catch (error) {
      logger.error('Error fetching model stats:', error);
      throw new Error('Failed to fetch model statistics');
    }
  }
}

export const modelsService = new ModelsService();
