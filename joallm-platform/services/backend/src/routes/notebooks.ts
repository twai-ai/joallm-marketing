import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import vm from 'node:vm';
import { db } from '../database/connection.js';
import { notebooks, notebookCells } from '../database/schema.js';
import { eq, and, desc, sql } from 'drizzle-orm';
import { logger } from '../utils/logger.js';
import { auditLog } from '../utils/audit.js';
import { authenticateToken } from '../middleware/auth.js';
import { llmService } from '../services/llm-providers.js';
import { ragService } from '../services/rag-service.js';
import { userApiKeyRepository } from '../repositories/user-api-key-repository.js';
import { getTierLimits, getUserTier } from '../middleware/subscription.js';

// Validation schemas
const SUPPORTED_CELL_TYPES = ['markdown', 'code', 'ai', 'knowledge'] as const;

const CreateNotebookSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  isPublic: z.boolean().optional().default(false),
});

const UpdateNotebookSchema = CreateNotebookSchema.partial();

const CellSchema = z.object({
  cellType: z.enum(SUPPORTED_CELL_TYPES),
  content: z.string(),
  output: z.string().optional(),
  position: z.number().int(),
  metadata: z.record(z.any()).optional(),
  attachedDocuments: z.array(z.string()).optional(),
  ragConfig: z.object({
    chunkSize: z.number(),
    overlap: z.number(),
    embeddingModel: z.string(),
    searchTopK: z.number(),
  }).optional(),
});

const CreateCellSchema = CellSchema;
const UpdateCellSchema = CellSchema.partial();

export async function notebooksRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
  // List user's notebooks
  fastify.get('/', {
    preHandler: authenticateToken,
    schema: {
      description: 'Get all notebooks for the authenticated user',
      tags: ['notebooks']
    }
  }, async (request, reply) => {
    try {
      const userId = (request as any).user.id;

      const userNotebooks = await db
        .select()
        .from(notebooks)
        .where(eq(notebooks.userId, userId))
        .orderBy(desc(notebooks.updatedAt));

      return { notebooks: userNotebooks };
    } catch (error) {
      logger.error('Failed to fetch notebooks:', error);
      return reply.status(500).send({ error: 'Failed to fetch notebooks' });
    }
  });

  // Get single notebook with cells
  fastify.get('/:notebookId', {
    preHandler: authenticateToken,
    schema: {
      description: 'Get a specific notebook with its cells',
      tags: ['notebooks'],
      params: {
        type: 'object',
        properties: {
          notebookId: { type: 'string' }
        },
        required: ['notebookId']
      }
    }
  }, async (request, reply) => {
    const { notebookId } = request.params as { notebookId: string };
    const userId = (request as any).user.id;

    try {
      // Get notebook
      const notebook = await db
        .select()
        .from(notebooks)
        .where(and(
          eq(notebooks.id, notebookId),
          eq(notebooks.userId, userId)
        ))
        .limit(1);

      if (notebook.length === 0) {
        return reply.status(404).send({ error: 'Notebook not found' });
      }

      // Get cells
      const cells = await db
        .select()
        .from(notebookCells)
        .where(eq(notebookCells.notebookId, notebookId))
        .orderBy(notebookCells.position);

      return {
        notebook: notebook[0],
        cells,
      };
    } catch (error) {
      logger.error(`Failed to fetch notebook ${notebookId}:`, error);
      return reply.status(500).send({ error: 'Failed to fetch notebook' });
    }
  });

  // Create notebook
  fastify.post('/', {
    preHandler: authenticateToken,
    schema: {
      description: 'Create a new notebook',
      tags: ['notebooks'],
      body: {
        type: 'object',
        required: ['title'],
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          isPublic: { type: 'boolean' },
        }
      }
    }
  }, async (request, reply) => {
    try {
      const userId = (request as any).user.id;
      const body = CreateNotebookSchema.parse(request.body);
      const tier = await getUserTier(userId);

      if (!tier) {
        return reply.status(404).send({ error: 'User not found' });
      }

      const limits = getTierLimits(tier);
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(notebooks)
        .where(eq(notebooks.userId, userId));

      const notebookCount = Number(count ?? 0);
      if (Number.isFinite(limits.maxNotebooks) && notebookCount >= limits.maxNotebooks) {
        return reply.status(403).send({
          error: 'Notebook limit reached',
          message: `Your ${tier} plan allows up to ${limits.maxNotebooks} notebooks. Upgrade to create more.`,
          currentTier: tier,
          maxNotebooks: limits.maxNotebooks,
        });
      }

      const [newNotebook] = await db
        .insert(notebooks)
        .values({
          userId,
          title: body.title,
          description: body.description,
          isPublic: body.isPublic,
        })
        .returning();

      logger.info(`Created notebook: ${newNotebook.id} for user ${userId}`);

      return reply.status(201).send({
        success: true,
        notebook: newNotebook,
      });
    } catch (error) {
      logger.error('Failed to create notebook:', error);
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation error',
          details: error.errors,
        });
      }
      return reply.status(500).send({ error: 'Failed to create notebook' });
    }
  });

  // Update notebook
  fastify.put('/:notebookId', {
    preHandler: authenticateToken,
    schema: {
      description: 'Update a notebook',
      tags: ['notebooks'],
      params: {
        type: 'object',
        properties: {
          notebookId: { type: 'string' }
        },
        required: ['notebookId']
      }
    }
  }, async (request, reply) => {
    const { notebookId } = request.params as { notebookId: string };
    const userId = (request as any).user.id;

    try {
      const body = UpdateNotebookSchema.parse(request.body);

      // Verify ownership
      const existing = await db
        .select()
        .from(notebooks)
        .where(and(
          eq(notebooks.id, notebookId),
          eq(notebooks.userId, userId)
        ))
        .limit(1);

      if (existing.length === 0) {
        return reply.status(404).send({ error: 'Notebook not found' });
      }

      const [updated] = await db
        .update(notebooks)
        .set({
          ...body,
          updatedAt: new Date(),
        })
        .where(eq(notebooks.id, notebookId))
        .returning();

      logger.info(`Updated notebook: ${notebookId}`);

      return { success: true, notebook: updated };
    } catch (error) {
      logger.error(`Failed to update notebook ${notebookId}:`, error);
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation error',
          details: error.errors,
        });
      }
      return reply.status(500).send({ error: 'Failed to update notebook' });
    }
  });

  // Delete notebook
  fastify.delete('/:notebookId', {
    preHandler: authenticateToken,
    schema: {
      description: 'Delete a notebook',
      tags: ['notebooks'],
      params: {
        type: 'object',
        properties: {
          notebookId: { type: 'string' }
        },
        required: ['notebookId']
      }
    }
  }, async (request, reply) => {
    const { notebookId } = request.params as { notebookId: string };
    const userId = (request as any).user.id;

    try {
      // Verify ownership
      const existing = await db
        .select()
        .from(notebooks)
        .where(and(
          eq(notebooks.id, notebookId),
          eq(notebooks.userId, userId)
        ))
        .limit(1);

      if (existing.length === 0) {
        return reply.status(404).send({ error: 'Notebook not found' });
      }

      // Delete notebook (cascades to cells)
      await db.delete(notebooks).where(eq(notebooks.id, notebookId));

      logger.info(`Deleted notebook: ${notebookId}`);

      return { success: true, message: 'Notebook deleted successfully' };
    } catch (error) {
      logger.error(`Failed to delete notebook ${notebookId}:`, error);
      return reply.status(500).send({ error: 'Failed to delete notebook' });
    }
  });

  // Add cell to notebook
  fastify.post('/:notebookId/cells', {
    preHandler: authenticateToken,
    schema: {
      description: 'Add a cell to notebook',
      tags: ['notebooks'],
      params: {
        type: 'object',
        properties: {
          notebookId: { type: 'string' }
        },
        required: ['notebookId']
      }
    }
  }, async (request, reply) => {
    const { notebookId } = request.params as { notebookId: string };
    const userId = (request as any).user.id;

    try {
      const body = CreateCellSchema.parse(request.body);

      // Verify notebook ownership
      const notebook = await db
        .select()
        .from(notebooks)
        .where(and(
          eq(notebooks.id, notebookId),
          eq(notebooks.userId, userId)
        ))
        .limit(1);

      if (notebook.length === 0) {
        return reply.status(404).send({ error: 'Notebook not found' });
      }

      const [newCell] = await db
        .insert(notebookCells)
        .values({
          notebookId,
          cellType: body.cellType,
          content: body.content,
          output: body.output,
          position: body.position,
          metadata: body.metadata || {},
          attachedDocuments: body.attachedDocuments || [],
          ragConfig: body.ragConfig,
        })
        .returning();

      logger.info(`Created cell: ${newCell.id} in notebook ${notebookId}`);

      return reply.status(201).send({
        success: true,
        cell: newCell,
      });
    } catch (error) {
      logger.error('Failed to create cell:', error);
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation error',
          details: error.errors,
        });
      }
      return reply.status(500).send({ error: 'Failed to create cell' });
    }
  });

  // Update cell
  fastify.put('/:notebookId/cells/:cellId', {
    preHandler: authenticateToken,
    schema: {
      description: 'Update a notebook cell',
      tags: ['notebooks'],
      params: {
        type: 'object',
        properties: {
          notebookId: { type: 'string' },
          cellId: { type: 'string' }
        },
        required: ['notebookId', 'cellId']
      }
    }
  }, async (request, reply) => {
    const { notebookId, cellId } = request.params as { notebookId: string; cellId: string };
    const userId = (request as any).user.id;

    try {
      const body = UpdateCellSchema.parse(request.body);

      // Verify notebook ownership
      const notebook = await db
        .select()
        .from(notebooks)
        .where(and(
          eq(notebooks.id, notebookId),
          eq(notebooks.userId, userId)
        ))
        .limit(1);

      if (notebook.length === 0) {
        return reply.status(404).send({ error: 'Notebook not found' });
      }

      // Verify cell belongs to notebook
      const cell = await db
        .select()
        .from(notebookCells)
        .where(and(
          eq(notebookCells.id, cellId),
          eq(notebookCells.notebookId, notebookId)
        ))
        .limit(1);

      if (cell.length === 0) {
        return reply.status(404).send({ error: 'Cell not found' });
      }

      const [updated] = await db
        .update(notebookCells)
        .set({
          ...body,
          updatedAt: new Date(),
        })
        .where(eq(notebookCells.id, cellId))
        .returning();

      logger.info(`Updated cell: ${cellId}`);

      return { success: true, cell: updated };
    } catch (error) {
      logger.error(`Failed to update cell ${cellId}:`, error);
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation error',
          details: error.errors,
        });
      }
      return reply.status(500).send({ error: 'Failed to update cell' });
    }
  });

  // Delete cell
  fastify.delete('/:notebookId/cells/:cellId', {
    preHandler: authenticateToken,
    schema: {
      description: 'Delete a notebook cell',
      tags: ['notebooks'],
      params: {
        type: 'object',
        properties: {
          notebookId: { type: 'string' },
          cellId: { type: 'string' }
        },
        required: ['notebookId', 'cellId']
      }
    }
  }, async (request, reply) => {
    const { notebookId, cellId } = request.params as { notebookId: string; cellId: string };
    const userId = (request as any).user.id;

    try {
      // Verify notebook ownership
      const notebook = await db
        .select()
        .from(notebooks)
        .where(and(
          eq(notebooks.id, notebookId),
          eq(notebooks.userId, userId)
        ))
        .limit(1);

      if (notebook.length === 0) {
        return reply.status(404).send({ error: 'Notebook not found' });
      }

      // Delete cell
      await db.delete(notebookCells).where(eq(notebookCells.id, cellId));

      logger.info(`Deleted cell: ${cellId}`);

      return { success: true, message: 'Cell deleted successfully' };
    } catch (error) {
      logger.error(`Failed to delete cell ${cellId}:`, error);
      return reply.status(500).send({ error: 'Failed to delete cell' });
    }
  });

  // Execute cell (placeholder for future implementation)
  fastify.post('/:notebookId/cells/:cellId/execute', {
    preHandler: authenticateToken,
    schema: {
      description: 'Execute a notebook cell',
      tags: ['notebooks'],
      params: {
        type: 'object',
        properties: {
          notebookId: { type: 'string' },
          cellId: { type: 'string' }
        },
        required: ['notebookId', 'cellId']
      }
    }
  }, async (request, reply) => {
    const { notebookId, cellId } = request.params as { notebookId: string; cellId: string };
    const userId = (request as any).user.id;

    try {
      // Verify notebook ownership
      const notebook = await db
        .select()
        .from(notebooks)
        .where(and(
          eq(notebooks.id, notebookId),
          eq(notebooks.userId, userId)
        ))
        .limit(1);

      if (notebook.length === 0) {
        return reply.status(404).send({ error: 'Notebook not found' });
      }

      // Get cell
      const cell = await db
        .select()
        .from(notebookCells)
        .where(eq(notebookCells.id, cellId))
        .limit(1);

      if (cell.length === 0) {
        return reply.status(404).send({ error: 'Cell not found' });
      }

      if (!SUPPORTED_CELL_TYPES.includes(cell[0].cellType as (typeof SUPPORTED_CELL_TYPES)[number])) {
        return reply.status(400).send({
          error: 'Unsupported cell type',
          message: `Cell type '${cell[0].cellType}' is disabled until runtime support is available.`,
        });
      }

      const notebookContextCells = await db
        .select()
        .from(notebookCells)
        .where(eq(notebookCells.notebookId, notebookId))
        .orderBy(notebookCells.position);

      // Fetch user API keys for AI cells
      const rawKeys = await userApiKeyRepository.getDecryptedApiKeys(userId);
      const userApiKeys: Record<string, string> = Object.fromEntries(
        Object.entries(rawKeys).filter(([, v]) => v !== undefined)
      ) as Record<string, string>;

      let cellOutput: string;
      const cellContent: string = interpolateNotebookTemplate(
        ((cell[0].content as string) || ''),
        notebookContextCells,
        cellId
      );

      switch (cell[0].cellType) {
        case 'ai': {
          // AI cell: execute the prompt through LLM (optionally with RAG context)
          const ragContext = (cell[0] as any).ragEnabled
            ? await ragService.search({ query: cellContent, fileIds: [], userId, limit: 3, threshold: 0.1, includeMetadata: false })
            : [];

          const context = ragContext.length > 0
            ? `Context from knowledge base:\n${ragContext.map(r => r.content).join('\n\n')}\n\nUser query:\n${cellContent}`
            : cellContent;

          const model = (cell[0] as any).model ?? 'claude-haiku-4-5-20251001';
          const result = await llmService.generateResponse(
            [{ role: 'user', content: context }],
            model,
            { maxTokens: 2048, temperature: 0.7, topP: 1, frequencyPenalty: 0, presencePenalty: 0 },
            Object.keys(userApiKeys).length > 0 ? userApiKeys : undefined
          );
          cellOutput = result.content;
          break;
        }

        case 'code': {
          // Code cell: run JavaScript in a sandboxed Node.js VM with timeout
          const logs: string[] = [];
          const notebookBindings = buildNotebookExecutionBindings(notebookContextCells, cellId);
          const sandbox = {
            console: { log: (...args: any[]) => logs.push(args.map(String).join(' ')) },
            result: undefined as any,
            cells: notebookBindings.cells,
            previous: notebookBindings.previous,
          };
          try {
            const script = new vm.Script(cellContent);
            const context = vm.createContext(sandbox);
            sandbox.result = script.runInContext(context, { timeout: 5000 });
            cellOutput = logs.length > 0
              ? logs.join('\n') + (sandbox.result !== undefined ? `\n=> ${JSON.stringify(sandbox.result)}` : '')
              : sandbox.result !== undefined ? String(JSON.stringify(sandbox.result)) : '(no output)';
          } catch (err) {
            cellOutput = `Error: ${err instanceof Error ? err.message : String(err)}`;
          }
          break;
        }

        case 'knowledge': {
          // Knowledge cell: RAG-powered retrieval from the knowledge base using attached documents
          const cellMeta = (cell[0].metadata as any) ?? {};
          const ragCfg = cellMeta.ragConfig ?? {};
          const fileIds: string[] = (cell[0] as any).attachedDocuments ?? [];
          const searchTopK: number = ragCfg.searchTopK ?? 5;
          const threshold: number = ragCfg.threshold ?? 0.5;

          const knowledgeResults = await ragService.search({
            query: cellContent,
            fileIds,
            limit: searchTopK,
            threshold,
            includeMetadata: true,
          });

          if (knowledgeResults.length === 0) {
            cellOutput = 'No relevant content found in the attached knowledge base. Try attaching documents or rephrasing your query.';
          } else {
            const formatted = knowledgeResults
              .map((r, idx) => {
                const source = (r.metadata as any)?.filename ?? 'Unknown source';
                return `### Source ${idx + 1}: ${source} (relevance: ${(r.score * 100).toFixed(1)}%)\n\n${r.content}`;
              })
              .join('\n\n---\n\n');
            cellOutput = `## Knowledge Base Results\n\n${formatted}`;
          }
          break;
        }

        case 'markdown':
          cellOutput = cellContent; // Markdown is just rendered, no execution needed
          break;

        default:
          cellOutput = `Unsupported cell type '${cell[0].cellType}'`;
      }

      // Update execution count and output
      const [updated] = await db
        .update(notebookCells)
        .set({
          output: cellOutput,
          executionCount: (cell[0].executionCount || 0) + 1,
          updatedAt: new Date(),
        })
        .where(eq(notebookCells.id, cellId))
        .returning();

      logger.info(`Executed cell: ${cellId} (type: ${cell[0].cellType})`);
      await auditLog('notebook_execute', {
        userId: (request as any).user?.id ?? null,
        resource: 'notebook_cell',
        resourceId: cellId,
        metadata: { notebookId, cellType: cell[0].cellType },
        request,
      });

      return {
        success: true,
        cell: updated,
        message: 'Cell executed successfully',
      };
    } catch (error) {
      logger.error(`Failed to execute cell ${cellId}:`, error);
      return reply.status(500).send({ error: 'Failed to execute cell' });
    }
  });

  // Reorder cells
  fastify.post('/:notebookId/cells/reorder', {
    preHandler: authenticateToken,
    schema: {
      description: 'Reorder notebook cells',
      tags: ['notebooks'],
      params: {
        type: 'object',
        properties: {
          notebookId: { type: 'string' }
        },
        required: ['notebookId']
      },
      body: {
        type: 'object',
        required: ['cellOrder'],
        properties: {
          cellOrder: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                cellId: { type: 'string' },
                position: { type: 'integer' }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { notebookId } = request.params as { notebookId: string };
    const userId = (request as any).user.id;
    const { cellOrder } = request.body as { cellOrder: Array<{ cellId: string; position: number }> };

    try {
      // Verify notebook ownership
      const notebook = await db
        .select()
        .from(notebooks)
        .where(and(
          eq(notebooks.id, notebookId),
          eq(notebooks.userId, userId)
        ))
        .limit(1);

      if (notebook.length === 0) {
        return reply.status(404).send({ error: 'Notebook not found' });
      }

      // Update positions
      await Promise.all(
        cellOrder.map(({ cellId, position }) =>
          db
            .update(notebookCells)
            .set({ position, updatedAt: new Date() })
            .where(eq(notebookCells.id, cellId))
        )
      );

      logger.info(`Reordered cells in notebook: ${notebookId}`);

      return { success: true, message: 'Cells reordered successfully' };
    } catch (error) {
      logger.error(`Failed to reorder cells in notebook ${notebookId}:`, error);
      return reply.status(500).send({ error: 'Failed to reorder cells' });
    }
  });
}

function buildNotebookExecutionBindings(
  notebookCellsForContext: Array<any>,
  activeCellId: string
): {
  cells: Record<string, { content: string; output?: string; type: string; position: number }>;
  previous: string;
} {
  const currentIndex = notebookCellsForContext.findIndex((item) => item.id === activeCellId);
  const priorCells = currentIndex >= 0 ? notebookCellsForContext.slice(0, currentIndex) : notebookCellsForContext;

  const cells = Object.fromEntries(
    priorCells.map((item) => [
      item.id,
      {
        content: String(item.content ?? ''),
        output: typeof item.output === 'string' ? item.output : item.output ? JSON.stringify(item.output) : '',
        type: String(item.cellType ?? 'unknown'),
        position: Number(item.position ?? 0),
      },
    ])
  );

  const previousCell = priorCells[priorCells.length - 1];
  return {
    cells,
    previous: typeof previousCell?.output === 'string' ? previousCell.output : previousCell?.output ? JSON.stringify(previousCell.output) : '',
  };
}

function interpolateNotebookTemplate(
  template: string,
  notebookCellsForContext: Array<any>,
  activeCellId: string
): string {
  const bindings = buildNotebookExecutionBindings(notebookCellsForContext, activeCellId);

  return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_match, rawToken) => {
    const token = String(rawToken).trim();

    if (token === 'previous') {
      return bindings.previous;
    }

    const [cellRef, field = 'output'] = token.split('.');
    const cell = bindings.cells[cellRef];
    if (!cell) {
      return '';
    }

    if (field === 'content') {
      return cell.content;
    }
    if (field === 'type') {
      return cell.type;
    }
    if (field === 'position') {
      return String(cell.position);
    }

    return cell.output ?? '';
  });
}
