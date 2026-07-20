import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import { db } from '../database/connection.js';
import { surveyResponses, surveyAnalytics } from '../database/schema.js';
import { eq, desc, sql } from 'drizzle-orm';
import { logger } from '../utils/logger.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const SurveyResponseSchema = z.object({
  userType: z.enum(['developer', 'business', 'analyst', 'casual']),
  companySize: z.enum(['1-10', '11-50', '51-200', '201-1000', '1000+']).optional(),
  industry: z.string().optional(),
  currentTools: z.array(z.string()).min(1, 'Please select at least one current tool'),
  primaryUseCase: z.string().min(1, 'Please specify your primary use case'),
  painPoints: z.array(z.string()).min(1, 'Please select at least one pain point'),
  featureRequests: z.array(z.string()).min(1, 'Please select at least one feature request'),
  budget: z.enum(['free', 'under-100', '100-500', '500-2000', '2000+']),
  contactEmail: z.string().email().optional().or(z.literal('')),
  additionalComments: z.string().optional(),
  source: z.enum(['landing-page', 'demo', 'referral', 'social-media', 'other']).default('landing-page'),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
});

const SurveyAnalyticsSchema = z.object({
  date: z.string(), // YYYY-MM-DD format
  userType: z.enum(['developer', 'business', 'analyst', 'casual']),
});

export async function surveyRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
  // Submit survey response
  fastify.post('/', {
    schema: {
      description: 'Submit survey response for build-measure-learn feedback',
      tags: ['survey'],
      body: {
        type: 'object',
        properties: {
          userType: { type: 'string', enum: ['developer', 'business', 'analyst', 'casual'] },
          companySize: { type: 'string', enum: ['1-10', '11-50', '51-200', '201-1000', '1000+'] },
          industry: { type: 'string' },
          currentTools: { type: 'array', items: { type: 'string' } },
          primaryUseCase: { type: 'string' },
          painPoints: { type: 'array', items: { type: 'string' } },
          featureRequests: { type: 'array', items: { type: 'string' } },
          budget: { type: 'string', enum: ['free', 'under-100', '100-500', '500-2000', '2000+'] },
          contactEmail: { type: 'string' },
          additionalComments: { type: 'string' },
          source: { type: 'string', enum: ['landing-page', 'demo', 'referral', 'social-media', 'other'] }
        },
        required: ['userType', 'currentTools', 'primaryUseCase', 'painPoints', 'featureRequests', 'budget']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            surveyId: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const body = SurveyResponseSchema.parse(request.body);

      // Get client IP and user agent
      const ipAddress = request.headers['x-forwarded-for'] as string ||
                       request.headers['x-real-ip'] as string ||
                       request.ip;
      const userAgent = request.headers['user-agent'];

      // Insert survey response
      const newSurvey = await db.insert(surveyResponses).values({
        userType: body.userType,
        companySize: body.companySize,
        industry: body.industry,
        currentTools: body.currentTools,
        primaryUseCase: body.primaryUseCase,
        painPoints: body.painPoints,
        featureRequests: body.featureRequests,
        budget: body.budget,
        contactEmail: body.contactEmail || null,
        additionalComments: body.additionalComments || null,
        source: body.source,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
      }).returning();

      const survey = newSurvey[0];

      logger.info('Survey response submitted', {
        surveyId: survey.id,
        userType: survey.userType,
        source: survey.source,
        ipAddress
      });

      // Trigger analytics update (async, don't wait for it)
      updateSurveyAnalytics().catch(error => {
        logger.error('Failed to update survey analytics:', error);
      });

      reply.send({
        success: true,
        message: 'Thank you for your feedback! We\'ll use this to improve JoaLLM.',
        surveyId: survey.id
      });
    } catch (error) {
      logger.error('Survey submission failed:', error);

      if (error instanceof z.ZodError) {
        reply.status(400).send({
          success: false,
          error: 'Validation error',
          message: 'Please check your survey responses',
          details: error.errors
        });
      } else {
        reply.status(500).send({
          success: false,
          error: 'Survey submission failed',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  });

  // Get survey analytics (for admin dashboard)
  fastify.get('/analytics', {
    preHandler: [authenticateToken, requireRole('admin')],
    schema: {
      description: 'Get survey analytics and insights',
      tags: ['survey'],
      querystring: {
        type: 'object',
        properties: {
          date: { type: 'string' }, // YYYY-MM-DD format
          userType: { type: 'string', enum: ['developer', 'business', 'analyst', 'casual'] }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            totalResponses: { type: 'number' },
            userTypeDistribution: {
              type: 'object',
              properties: {
                developer: { type: 'number' },
                business: { type: 'number' },
                analyst: { type: 'number' },
                casual: { type: 'number' }
              }
            },
            topPainPoints: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  point: { type: 'string' },
                  count: { type: 'number' },
                  percentage: { type: 'number' }
                }
              }
            },
            topFeatures: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  feature: { type: 'string' },
                  count: { type: 'number' },
                  percentage: { type: 'number' }
                }
              }
            },
            budgetDistribution: {
              type: 'object',
              properties: {
                free: { type: 'number' },
                'under-100': { type: 'number' },
                '100-500': { type: 'number' },
                '500-2000': { type: 'number' },
                '2000+': { type: 'number' }
              }
            },
            recentResponses: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  userType: { type: 'string' },
                  primaryUseCase: { type: 'string' },
                  completedAt: { type: 'string' }
                }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { date, userType } = request.query as { date?: string; userType?: string };

    try {
      // Build where clause for filtering
      let whereClause: any = undefined;
      if (date && userType) {
        whereClause = sql`DATE(${surveyResponses.completedAt}) = ${date} AND ${surveyResponses.userType} = ${userType}`;
      } else if (date) {
        whereClause = sql`DATE(${surveyResponses.completedAt}) = ${date}`;
      } else if (userType) {
        whereClause = eq(surveyResponses.userType, userType as 'developer' | 'business' | 'analyst' | 'casual');
      }

      // Get total responses
      const totalResponses = await db.query.surveyResponses.findMany({
        where: whereClause,
      });

      // Calculate user type distribution
      const userTypeCounts = totalResponses.reduce((acc, response) => {
        if (response.userType) {
          acc[response.userType] = (acc[response.userType] || 0) + 1;
        }
        return acc;
      }, {} as Record<'developer' | 'business' | 'analyst' | 'casual', number>);

      const userTypeDistribution = {
        developer: userTypeCounts.developer || 0,
        business: userTypeCounts.business || 0,
        analyst: userTypeCounts.analyst || 0,
        casual: userTypeCounts.casual || 0,
      };

      // Calculate top pain points
      const painPointsMap = new Map<string, number>();
      totalResponses.forEach(response => {
        response.painPoints.forEach(point => {
          painPointsMap.set(point, (painPointsMap.get(point) || 0) + 1);
        });
      });

      const topPainPoints = Array.from(painPointsMap.entries())
        .map(([point, count]) => ({
          point,
          count,
          percentage: Math.round((count / totalResponses.length) * 100)
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Calculate top features
      const featuresMap = new Map<string, number>();
      totalResponses.forEach(response => {
        response.featureRequests.forEach(feature => {
          featuresMap.set(feature, (featuresMap.get(feature) || 0) + 1);
        });
      });

      const topFeatures = Array.from(featuresMap.entries())
        .map(([feature, count]) => ({
          feature,
          count,
          percentage: Math.round((count / totalResponses.length) * 100)
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Calculate budget distribution
      const budgetCounts = totalResponses.reduce((acc, response) => {
        if (response.budget) {
          acc[response.budget] = (acc[response.budget] || 0) + 1;
        }
        return acc;
      }, {} as Record<'free' | 'under-100' | '100-500' | '500-2000' | '2000+', number>);

      const budgetDistribution = {
        free: budgetCounts.free || 0,
        'under-100': budgetCounts['under-100'] || 0,
        '100-500': budgetCounts['100-500'] || 0,
        '500-2000': budgetCounts['500-2000'] || 0,
        '2000+': budgetCounts['2000+'] || 0,
      };

      // Get recent responses (last 20)
      const recentResponses = await db.query.surveyResponses.findMany({
        orderBy: [desc(surveyResponses.completedAt)],
        limit: 20,
      });

      reply.send({
        totalResponses: totalResponses.length,
        userTypeDistribution,
        topPainPoints,
        topFeatures,
        budgetDistribution,
        recentResponses: recentResponses.map(response => ({
          id: response.id,
          userType: response.userType,
          primaryUseCase: response.primaryUseCase,
          completedAt: response.completedAt.toISOString()
        }))
      });
    } catch (error) {
      logger.error('Failed to retrieve survey analytics:', error);
      reply.status(500).send({
        error: 'Failed to retrieve survey analytics',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get survey responses with pagination (for admin)
  fastify.get('/responses', {
    preHandler: [authenticateToken, requireRole('admin')],
    schema: {
      description: 'Get survey responses with pagination and filters',
      tags: ['survey'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', default: 1 },
          limit: { type: 'number', default: 20 },
          userType: { type: 'string', enum: ['developer', 'business', 'analyst', 'casual'] },
          dateFrom: { type: 'string' },
          dateTo: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            responses: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  userType: { type: 'string' },
                  companySize: { type: 'string' },
                  industry: { type: 'string' },
                  currentTools: { type: 'array', items: { type: 'string' } },
                  primaryUseCase: { type: 'string' },
                  painPoints: { type: 'array', items: { type: 'string' } },
                  featureRequests: { type: 'array', items: { type: 'string' } },
                  budget: { type: 'string' },
                  contactEmail: { type: 'string' },
                  additionalComments: { type: 'string' },
                  source: { type: 'string' },
                  completedAt: { type: 'string' }
                }
              }
            },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'number' },
                limit: { type: 'number' },
                total: { type: 'number' },
                pages: { type: 'number' }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { page = 1, limit = 20, userType, dateFrom, dateTo } = request.query as {
      page?: number;
      limit?: number;
      userType?: string;
      dateFrom?: string;
      dateTo?: string;
    };

    try {
      const offset = (page - 1) * limit;

      // Build where clause for filtering
      let whereClause: any = undefined;
      if (userType && dateFrom && dateTo) {
        whereClause = sql`${surveyResponses.userType} = ${userType} AND DATE(${surveyResponses.completedAt}) BETWEEN ${dateFrom} AND ${dateTo}`;
      } else if (userType) {
        whereClause = eq(surveyResponses.userType, userType as 'developer' | 'business' | 'analyst' | 'casual');
      } else if (dateFrom && dateTo) {
        whereClause = sql`DATE(${surveyResponses.completedAt}) BETWEEN ${dateFrom} AND ${dateTo}`;
      }

      const responses = await db.query.surveyResponses.findMany({
        where: whereClause,
        orderBy: [desc(surveyResponses.completedAt)],
        limit,
        offset,
      });

      // Get total count for pagination
      const totalCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(surveyResponses)
        .where(whereClause);

      const total = totalCount[0]?.count || 0;

      reply.send({
        responses: responses.map(response => ({
          id: response.id,
          userType: response.userType,
          companySize: response.companySize,
          industry: response.industry,
          currentTools: response.currentTools,
          primaryUseCase: response.primaryUseCase,
          painPoints: response.painPoints,
          featureRequests: response.featureRequests,
          budget: response.budget,
          contactEmail: response.contactEmail,
          additionalComments: response.additionalComments,
          source: response.source,
          completedAt: response.completedAt.toISOString()
        })),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      logger.error('Failed to retrieve survey responses:', error);
      reply.status(500).send({
        error: 'Failed to retrieve survey responses',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}

// Background function to update survey analytics
async function updateSurveyAnalytics(): Promise<void> {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

    // Get all responses for today
    const todayResponses = await db.query.surveyResponses.findMany({
      where: sql`DATE(${surveyResponses.completedAt}) = ${today}`,
    });

    if (todayResponses.length === 0) {
      return; // No responses today, skip update
    }

    // Calculate analytics for each user type
    const userTypes = ['developer', 'business', 'analyst', 'casual'] as const;

    for (const userType of userTypes) {
      const typeResponses = todayResponses.filter(r => r.userType === userType);

      if (typeResponses.length === 0) continue;

      // Calculate pain points
      const painPointsMap = new Map<string, number>();
      typeResponses.forEach(response => {
        response.painPoints.forEach(point => {
          painPointsMap.set(point, (painPointsMap.get(point) || 0) + 1);
        });
      });

      const topPainPoints = Array.from(painPointsMap.entries())
        .map(([point, count]) => ({
          point,
          count,
          percentage: Math.round((count / typeResponses.length) * 100)
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Calculate features
      const featuresMap = new Map<string, number>();
      typeResponses.forEach(response => {
        response.featureRequests.forEach(feature => {
          featuresMap.set(feature, (featuresMap.get(feature) || 0) + 1);
        });
      });

      const topFeatures = Array.from(featuresMap.entries())
        .map(([feature, count]) => ({
          feature,
          count,
          percentage: Math.round((count / typeResponses.length) * 100)
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Calculate average budget
      const budgetOrder = { 'free': 0, 'under-100': 1, '100-500': 2, '500-2000': 3, '2000+': 4 };
      const budgetScores = typeResponses
        .map(r => budgetOrder[r.budget as keyof typeof budgetOrder])
        .filter(score => score !== undefined);
      const averageBudgetScore = budgetScores.length > 0
        ? Math.round(budgetScores.reduce((a, b) => a + b, 0) / budgetScores.length)
        : 0;
      const averageBudget = Object.keys(budgetOrder)[averageBudgetScore] as keyof typeof budgetOrder;

      // Calculate industry distribution
      const industryMap = new Map<string, number>();
      typeResponses.forEach(response => {
        if (response.industry) {
          industryMap.set(response.industry, (industryMap.get(response.industry) || 0) + 1);
        }
      });

      const industryDistribution = Array.from(industryMap.entries())
        .map(([industry, count]) => ({
          industry,
          count,
          percentage: Math.round((count / typeResponses.length) * 100)
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Calculate use case distribution
      const useCaseMap = new Map<string, number>();
      typeResponses.forEach(response => {
        useCaseMap.set(response.primaryUseCase, (useCaseMap.get(response.primaryUseCase) || 0) + 1);
      });

      const useCaseDistribution = Array.from(useCaseMap.entries())
        .map(([useCase, count]) => ({
          useCase,
          count,
          percentage: Math.round((count / typeResponses.length) * 100)
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Check if analytics record already exists for today
      const existingAnalytics = await db.query.surveyAnalytics.findFirst({
        where: sql`${surveyAnalytics.date} = ${today} AND ${surveyAnalytics.userType} = ${userType}`,
      });

      if (existingAnalytics) {
        // Update existing record
        await db
          .update(surveyAnalytics)
          .set({
            totalResponses: typeResponses.length,
            topPainPoints,
            topFeatures,
            averageBudget,
            industryDistribution,
            useCaseDistribution,
          })
          .where(sql`${surveyAnalytics.id} = ${existingAnalytics.id}`);
      } else {
        // Create new record
        await db.insert(surveyAnalytics).values({
          date: today,
          userType,
          totalResponses: typeResponses.length,
          topPainPoints,
          topFeatures,
          averageBudget,
          industryDistribution,
          useCaseDistribution,
        });
      }
    }

    logger.info('Survey analytics updated successfully', { date: today });
  } catch (error) {
    logger.error('Failed to update survey analytics:', error);
    throw error;
  }
}
