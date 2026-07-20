import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import { db } from '../database/connection.js';
import { workflows, workflowExecutions } from '../database/schema.js';
import { eq, and, or, desc } from 'drizzle-orm';
import { logger } from '../utils/logger.js';
import { authenticateToken, requirePermission } from '../middleware/auth.js';
import { optionalWorkspaceContext, getWorkspaceId } from '../middleware/workspace.js';
import { workflowExecutionQueue } from '../services/queue.js';
import { runWorkflowExecution } from '../services/workflow-runner.js';
import { getTierLimits, getUserTier } from '../middleware/subscription.js';

const workflowSelectFields = {
  id: workflows.id,
  userId: workflows.userId,
  name: workflows.name,
  description: workflows.description,
  nodes: workflows.nodes,
  edges: workflows.edges,
  isPublic: workflows.isPublic,
  isTemplate: workflows.isTemplate,
  createdAt: workflows.createdAt,
  updatedAt: workflows.updatedAt,
};

const executionSelectFields = {
  id: workflowExecutions.id,
  workflowId: workflowExecutions.workflowId,
  userId: workflowExecutions.userId,
  status: workflowExecutions.status,
  input: workflowExecutions.input,
  output: workflowExecutions.output,
  error: workflowExecutions.error,
  executionLog: workflowExecutions.executionLog,
  startedAt: workflowExecutions.startedAt,
  completedAt: workflowExecutions.completedAt,
};

function getWorkflowDebugContext(request: any, body?: unknown) {
  const user = (request as any).user;
  const workspaceId = getWorkspaceId(request as any) ?? null;
  const payload = (body ?? request.body ?? {}) as Record<string, any>;

  return {
    userId: user?.id ?? null,
    email: user?.email ?? null,
    role: user?.role ?? null,
    workspaceId,
    name: typeof payload.name === 'string' ? payload.name : null,
    nameLength: typeof payload.name === 'string' ? payload.name.length : null,
    nodeCount: Array.isArray(payload.nodes) ? payload.nodes.length : null,
    edgeCount: Array.isArray(payload.edges) ? payload.edges.length : null,
    nodeTypes: Array.isArray(payload.nodes)
      ? payload.nodes.map((node: Record<string, any>) => node?.type).filter(Boolean)
      : null,
  };
}

function sendWorkflowInternalError(reply: any, request: any, error: unknown, fallbackMessage: string) {
  const email = String((request as any).user?.email || '').toLowerCase();
  const message = error instanceof Error ? error.message : String(error);

  if (email === 'support@joallm.ai') {
    return reply.status(500).send({
      error: fallbackMessage,
      debugMessage: message,
      debugContext: getWorkflowDebugContext(request),
    });
  }

  return reply.status(500).send({ error: fallbackMessage });
}

async function runWorkflowInProcess(executionId: string): Promise<void> {
  setImmediate(async () => {
    try {
      await runWorkflowExecution(executionId);
    } catch (error) {
      logger.error(`Workflow execution ${executionId} failed:`, error);
      await db
        .update(workflowExecutions)
        .set({
          status: 'failed',
          output: { error: error instanceof Error ? error.message : 'Unknown error' },
          error: error instanceof Error ? error.message : 'Unknown error',
          completedAt: new Date(),
        })
        .where(eq(workflowExecutions.id, executionId));
    }
  });
}

// Validation schemas
const WorkflowNodeSchema = z.object({
  id: z.string(),
  type: z.string(),
  name: z.string().optional(),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  data: z.record(z.any()),
  connections: z.array(z.string()).optional(),
}).passthrough();

const WorkflowEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().optional(),
  targetHandle: z.string().optional(),
  label: z.string().optional(),
}).passthrough();

const CreateWorkflowSchema = z.object({
  name: z.string().min(1, 'Workflow name is required').max(100, 'Workflow name must be 100 characters or fewer'),
  description: z.string().optional(),
  nodes: z.array(WorkflowNodeSchema),
  edges: z.array(WorkflowEdgeSchema),
  isPublic: z.boolean().optional().default(false),
  isTemplate: z.boolean().optional().default(false),
});

const UpdateWorkflowSchema = CreateWorkflowSchema.partial();

const ExecuteWorkflowSchema = z.object({
  input: z.record(z.any()).optional(),
});

const workflowReadRateLimit = {
  max: 300,
  timeWindow: '1 minute',
} as const;

const workflowWriteRateLimit = {
  max: 120,
  timeWindow: '1 minute',
} as const;

export async function workflowRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
  // List user's workflows
  fastify.get('/', {
    preHandler: [authenticateToken, optionalWorkspaceContext as any],
    config: {
      rateLimit: workflowReadRateLimit,
    },
    schema: {
      description: 'Get all workflows for the authenticated user',
      tags: ['workflows'],
      response: {
        200: {
          type: 'object',
          properties: {
            workflows: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  description: { type: 'string' },
                  nodes: { type: 'array' },
                  edges: { type: 'array' },
                  isPublic: { type: 'boolean' },
                  isTemplate: { type: 'boolean' },
                  createdAt: { type: 'string' },
                  updatedAt: { type: 'string' },
                }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const userId = (request as any).user.id;
      const workspaceId = getWorkspaceId(request);

      // When a workspace context is active, return workflows owned by the user
      // OR belonging to that workspace (shared team workflows).
      const whereClause = workspaceId
        ? or(eq(workflows.userId, userId), eq(workflows.workspaceId, workspaceId))
        : eq(workflows.userId, userId);

      const userWorkflows = await db
        .select(workflowSelectFields)
        .from(workflows)
        .where(whereClause)
        .orderBy(desc(workflows.updatedAt));

      return { workflows: userWorkflows };
    } catch (error) {
      logger.error('Failed to fetch workflows:', {
        error,
        context: getWorkflowDebugContext(request),
      });
      return sendWorkflowInternalError(reply, request, error, 'Failed to fetch workflows');
    }
  });

  // Get single workflow
  fastify.get('/:workflowId', {
    preHandler: authenticateToken,
    config: {
      rateLimit: workflowReadRateLimit,
    },
    schema: {
      description: 'Get a specific workflow by ID',
      tags: ['workflows'],
      params: {
        type: 'object',
        properties: {
          workflowId: { type: 'string' }
        },
        required: ['workflowId']
      }
    }
  }, async (request, reply) => {
    const { workflowId } = request.params as { workflowId: string };
    const userId = (request as any).user.id;

    try {
      const workflow = await db
        .select(workflowSelectFields)
        .from(workflows)
        .where(and(
          eq(workflows.id, workflowId),
          eq(workflows.userId, userId)
        ))
        .limit(1);

      if (workflow.length === 0) {
        return reply.status(404).send({ error: 'Workflow not found' });
      }

      return workflow[0];
    } catch (error) {
      logger.error(`Failed to fetch workflow ${workflowId}:`, {
        error,
        context: getWorkflowDebugContext(request),
      });
      return sendWorkflowInternalError(reply, request, error, 'Failed to fetch workflow');
    }
  });

  // Create workflow
  fastify.post('/', {
    preHandler: [authenticateToken, requirePermission('workflow.manage'), optionalWorkspaceContext as any],
    config: {
      rateLimit: workflowWriteRateLimit,
    },
    schema: {
      description: 'Create a new workflow',
      tags: ['workflows'],
      body: {
        type: 'object',
        required: ['name', 'nodes', 'edges'],
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          nodes: { type: 'array' },
          edges: { type: 'array' },
          isPublic: { type: 'boolean' },
          isTemplate: { type: 'boolean' },
        }
      }
    }
  }, async (request, reply) => {
    try {
      const userId = (request as any).user.id;
      const body = CreateWorkflowSchema.parse(request.body);
      const tier = await getUserTier(userId);

      if (!tier) {
        return reply.status(404).send({ error: 'User not found' });
      }

      const limits = getTierLimits(tier);
      const existingWorkflows = await db
        .select({ id: workflows.id })
        .from(workflows)
        .where(eq(workflows.userId, userId));

      if (Number.isFinite(limits.maxWorkflows) && existingWorkflows.length >= limits.maxWorkflows) {
        return reply.status(403).send({
          error: 'Workflow limit reached',
          message: `Your ${tier} plan allows up to ${limits.maxWorkflows} workflows. Upgrade to create more.`,
          currentTier: tier,
          maxWorkflows: limits.maxWorkflows,
        });
      }

      const workspaceId = getWorkspaceId(request) ?? null;

      const [newWorkflow] = await db
        .insert(workflows)
        .values({
          userId,
          ...(workspaceId ? { workspaceId } : {}),
          name: body.name,
          description: body.description,
          nodes: body.nodes,
          edges: body.edges,
          isPublic: body.isPublic,
          isTemplate: body.isTemplate,
        })
        .returning(workflowSelectFields);

      logger.info(`Created workflow: ${newWorkflow.id} for user ${userId}`);

      return reply.status(201).send({
        success: true,
        workflow: newWorkflow,
      });
    } catch (error) {
      logger.error('Failed to create workflow:', {
        error,
        context: getWorkflowDebugContext(request),
      });
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation error',
          details: error.errors,
        });
      }
      return sendWorkflowInternalError(reply, request, error, 'Failed to create workflow');
    }
  });

  // Update workflow
  fastify.put('/:workflowId', {
    preHandler: [authenticateToken, requirePermission('workflow.manage')],
    config: {
      rateLimit: workflowWriteRateLimit,
    },
    schema: {
      description: 'Update an existing workflow',
      tags: ['workflows'],
      params: {
        type: 'object',
        properties: {
          workflowId: { type: 'string' }
        },
        required: ['workflowId']
      }
    }
  }, async (request, reply) => {
    const { workflowId } = request.params as { workflowId: string };
    const userId = (request as any).user.id;

    try {
      const body = UpdateWorkflowSchema.parse(request.body);

      // Verify ownership
      const existing = await db
        .select({ id: workflows.id })
        .from(workflows)
        .where(and(
          eq(workflows.id, workflowId),
          eq(workflows.userId, userId)
        ))
        .limit(1);

      if (existing.length === 0) {
        return reply.status(404).send({ error: 'Workflow not found' });
      }

      const [updatedWorkflow] = await db
        .update(workflows)
        .set({
          ...body,
          updatedAt: new Date(),
        })
        .where(eq(workflows.id, workflowId))
        .returning(workflowSelectFields);

      logger.info(`Updated workflow: ${workflowId}`);

      return { success: true, workflow: updatedWorkflow };
    } catch (error) {
      logger.error(`Failed to update workflow ${workflowId}:`, {
        error,
        context: getWorkflowDebugContext(request),
      });
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation error',
          details: error.errors,
        });
      }
      return sendWorkflowInternalError(reply, request, error, 'Failed to update workflow');
    }
  });

  // Delete workflow
  fastify.delete('/:workflowId', {
    preHandler: authenticateToken,
    config: {
      rateLimit: workflowWriteRateLimit,
    },
    schema: {
      description: 'Delete a workflow',
      tags: ['workflows'],
      params: {
        type: 'object',
        properties: {
          workflowId: { type: 'string' }
        },
        required: ['workflowId']
      }
    }
  }, async (request, reply) => {
    const { workflowId } = request.params as { workflowId: string };
    const userId = (request as any).user.id;

    try {
      // Verify ownership
      const existing = await db
        .select({ id: workflows.id })
        .from(workflows)
        .where(and(
          eq(workflows.id, workflowId),
          eq(workflows.userId, userId)
        ))
        .limit(1);

      if (existing.length === 0) {
        return reply.status(404).send({ error: 'Workflow not found' });
      }

      await db.delete(workflows).where(eq(workflows.id, workflowId));

      logger.info(`Deleted workflow: ${workflowId}`);

      return { success: true, message: 'Workflow deleted successfully' };
    } catch (error) {
      logger.error(`Failed to delete workflow ${workflowId}:`, {
        error,
        context: getWorkflowDebugContext(request),
      });
      return sendWorkflowInternalError(reply, request, error, 'Failed to delete workflow');
    }
  });

  // Execute workflow
  fastify.post('/:workflowId/execute', {
    preHandler: authenticateToken,
    config: {
      rateLimit: workflowWriteRateLimit,
    },
    schema: {
      description: 'Execute a workflow',
      tags: ['workflows'],
      params: {
        type: 'object',
        properties: {
          workflowId: { type: 'string' }
        },
        required: ['workflowId']
      }
    }
  }, async (request, reply) => {
    const { workflowId } = request.params as { workflowId: string };
    const userId = (request as any).user.id;

    try {
      const body = ExecuteWorkflowSchema.parse(request.body);

      // Verify workflow exists and user has access
      const workflow = await db
        .select(workflowSelectFields)
        .from(workflows)
        .where(eq(workflows.id, workflowId))
        .limit(1);

      if (workflow.length === 0) {
        return reply.status(404).send({ error: 'Workflow not found' });
      }

      if (workflow[0].userId !== userId && !workflow[0].isPublic) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      // Create execution record
      const [execution] = await db
        .insert(workflowExecutions)
        .values({
          workflowId,
          userId,
          status: 'running',
          input: body.input || {},
          startedAt: new Date(),
        })
        .returning(executionSelectFields);

      logger.info(`Started workflow execution: ${execution.id} for workflow ${workflowId}`);

      if (workflowExecutionQueue) {
        try {
          await workflowExecutionQueue.add('execute-workflow' as any, { executionId: execution.id });
        } catch (queueError) {
          logger.warn(`Workflow queue unavailable for execution ${execution.id}, falling back to in-process execution`, queueError);
          runWorkflowInProcess(execution.id);
        }
      } else {
        runWorkflowInProcess(execution.id);
      }

      return reply.status(202).send({
        success: true,
        execution: {
          id: execution.id,
          status: execution.status,
          message: 'Workflow execution started',
        },
      });
    } catch (error) {
      logger.error(`Failed to execute workflow ${workflowId}:`, {
        error,
        context: getWorkflowDebugContext(request),
      });
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation error',
          details: error.errors,
        });
      }
      return sendWorkflowInternalError(reply, request, error, 'Failed to execute workflow');
    }
  });

  // Get workflow executions
  fastify.get('/:workflowId/executions', {
    preHandler: authenticateToken,
    config: {
      rateLimit: workflowReadRateLimit,
    },
    schema: {
      description: 'Get execution history for a workflow',
      tags: ['workflows'],
      params: {
        type: 'object',
        properties: {
          workflowId: { type: 'string' }
        },
        required: ['workflowId']
      }
    }
  }, async (request, reply) => {
    const { workflowId } = request.params as { workflowId: string };
    const userId = (request as any).user.id;

    try {
      // Verify workflow access
      const workflow = await db
        .select()
        .from(workflows)
        .where(eq(workflows.id, workflowId))
        .limit(1);

      if (workflow.length === 0) {
        return reply.status(404).send({ error: 'Workflow not found' });
      }

      if (workflow[0].userId !== userId && !workflow[0].isPublic) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      const executions = await db
        .select(executionSelectFields)
        .from(workflowExecutions)
        .where(eq(workflowExecutions.workflowId, workflowId))
        .orderBy(desc(workflowExecutions.startedAt));

      return { executions };
    } catch (error) {
      logger.error(`Failed to fetch executions for workflow ${workflowId}:`, error);
      return reply.status(500).send({ error: 'Failed to fetch executions' });
    }
  });

  // Get single execution status
  fastify.get('/executions/:executionId', {
    preHandler: authenticateToken,
    config: {
      rateLimit: workflowReadRateLimit,
    },
    schema: {
      description: 'Get execution status by ID',
      tags: ['workflows'],
      params: {
        type: 'object',
        properties: {
          executionId: { type: 'string' }
        },
        required: ['executionId']
      }
    }
  }, async (request, reply) => {
    const { executionId } = request.params as { executionId: string };
    const userId = (request as any).user.id;

    try {
      const execution = await db
        .select(executionSelectFields)
        .from(workflowExecutions)
        .where(and(
          eq(workflowExecutions.id, executionId),
          eq(workflowExecutions.userId, userId)
        ))
        .limit(1);

      if (execution.length === 0) {
        return reply.status(404).send({ error: 'Execution not found' });
      }

      return execution[0];
    } catch (error) {
      logger.error(`Failed to fetch execution ${executionId}:`, error);
      return reply.status(500).send({ error: 'Failed to fetch execution' });
    }
  });

  // Cancel workflow execution
  fastify.post('/executions/:executionId/cancel', {
    preHandler: authenticateToken,
    config: {
      rateLimit: workflowWriteRateLimit,
    },
    schema: {
      description: 'Cancel a running workflow execution',
      tags: ['workflows'],
      params: {
        type: 'object',
        properties: {
          executionId: { type: 'string' }
        },
        required: ['executionId']
      }
    }
  }, async (request, reply) => {
    const { executionId } = request.params as { executionId: string };
    const userId = (request as any).user.id;

    try {
      const execution = await db
        .select(executionSelectFields)
        .from(workflowExecutions)
        .where(and(
          eq(workflowExecutions.id, executionId),
          eq(workflowExecutions.userId, userId)
        ))
        .limit(1);

      if (execution.length === 0) {
        return reply.status(404).send({ error: 'Execution not found' });
      }

      if (execution[0].status !== 'running' && execution[0].status !== 'suspended') {
        return reply.status(400).send({ error: 'Execution is not running' });
      }

      await db
        .update(workflowExecutions)
        .set({
          status: 'cancelled',
          completedAt: new Date(),
        })
        .where(eq(workflowExecutions.id, executionId));

      logger.info(`Cancelled execution: ${executionId}`);

      return { success: true, message: 'Execution cancelled' };
    } catch (error) {
      logger.error(`Failed to cancel execution ${executionId}:`, error);
      return reply.status(500).send({ error: 'Failed to cancel execution' });
    }
  });
}
