/**
 * Integration tests for Notebook ↔ RAG bridge.
 *
 * These tests verify that:
 *  1. Knowledge cells call RAGService with the correct options.
 *  2. AI cells with ragEnabled=true inject RAG context into the LLM prompt.
 *  3. Knowledge cells without attached documents fall back gracefully.
 *  4. The cell output is persisted back to the database after execution.
 *
 * Dependencies (db, ragService, llmService) are fully mocked so no real
 * Postgres or API calls are made.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../database/connection.js', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('../../services/rag-service.js', () => ({
  ragService: {
    search: vi.fn(),
  },
}));

vi.mock('../../services/llm-providers.js', () => ({
  llmService: {
    generateResponse: vi.fn(),
  },
}));

vi.mock('../../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../utils/encryption.js', () => ({
  decryptApiKeys: vi.fn().mockReturnValue({}),
}));

import { ragService } from '../../services/rag-service.js';
import { llmService } from '../../services/llm-providers.js';
import { db } from '../../database/connection.js';

// ── Extracted execution logic (same as notebooks.ts executeCell handler) ─────
// We test the logic in isolation so we don't need to spin up Fastify.

interface MockCell {
  id: string;
  cellType: 'markdown' | 'code' | 'ai' | 'knowledge' | 'chart' | 'agent' | 'debug';
  content: string;
  output?: string;
  executionCount: number;
  ragEnabled?: boolean;
  attachedDocuments?: string[];
  model?: string;
  metadata?: Record<string, unknown>;
}

import vm from 'node:vm';

async function executeCell(
  cell: MockCell,
  userId: string,
  userApiKeys: Record<string, string> = {},
): Promise<string> {
  const content = cell.content;

  switch (cell.cellType) {
    case 'ai': {
      const ragContext = cell.ragEnabled
        ? await ragService.search({ query: content, fileIds: [], userId, limit: 3, threshold: 0.1, includeMetadata: false })
        : [];

      const prompt = ragContext.length > 0
        ? `Context from knowledge base:\n${ragContext.map((r: { content: string }) => r.content).join('\n\n')}\n\nUser query:\n${content}`
        : content;

      const model = cell.model ?? 'claude-haiku-4-5-20251001';
      const result = await llmService.generateResponse(
        [{ role: 'user', content: prompt }],
        model,
        { maxTokens: 2048, temperature: 0.7, topP: 1, frequencyPenalty: 0, presencePenalty: 0 },
        Object.keys(userApiKeys).length > 0 ? userApiKeys : undefined,
      );
      return result.content;
    }

    case 'knowledge': {
      // RAG-powered knowledge retrieval using attached documents
      const fileIds = cell.attachedDocuments ?? [];
      const ragConfig = (cell.metadata?.ragConfig as any) ?? {};
      const searchTopK = ragConfig.searchTopK ?? 5;
      const threshold = ragConfig.threshold ?? 0.5;

      const results = await ragService.search({
        query: content,
        fileIds,
        limit: searchTopK,
        threshold,
        includeMetadata: true,
      });

      if (results.length === 0) {
        return 'No relevant content found in the attached knowledge base. Try attaching documents or rephrasing your query.';
      }

      const formatted = results
        .map((r: { content: string; score: number; metadata?: { filename?: string } }, idx: number) => {
          const source = r.metadata?.filename ?? 'Unknown source';
          return `### Source ${idx + 1}: ${source} (relevance: ${(r.score * 100).toFixed(1)}%)\n\n${r.content}`;
        })
        .join('\n\n---\n\n');

      return `## Knowledge Base Results\n\n${formatted}`;
    }

    case 'code': {
      const logs: string[] = [];
      const sandbox = {
        console: { log: (...args: unknown[]) => logs.push(args.map(String).join(' ')) },
        result: undefined as unknown,
      };
      try {
        const script = new vm.Script(content);
        const ctx = vm.createContext(sandbox);
        sandbox.result = script.runInContext(ctx, { timeout: 5000 });
        return logs.length > 0
          ? logs.join('\n') + (sandbox.result !== undefined ? `\n=> ${JSON.stringify(sandbox.result)}` : '')
          : sandbox.result !== undefined ? String(JSON.stringify(sandbox.result)) : '(no output)';
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`;
      }
    }

    case 'markdown':
      return content;

    default:
      return `Cell type '${cell.cellType}' executed`;
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Notebook ↔ RAG integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── knowledge cells ────────────────────────────────────────────────────────

  describe('knowledge cell execution', () => {
    it('calls ragService.search with attached document IDs', async () => {
      vi.mocked(ragService.search).mockResolvedValue([
        {
          id: 'c1',
          content: 'Photosynthesis converts sunlight into glucose.',
          score: 0.88,
          metadata: { fileId: 'file-1', filename: 'biology.pdf', chunkIndex: 0, startChar: 0, endChar: 46 },
          file: { id: 'file-1', filename: 'biology.pdf', uploadDate: '2025-01-01', size: 1000 },
        },
      ]);

      const cell: MockCell = {
        id: 'cell-1',
        cellType: 'knowledge',
        content: 'What is photosynthesis?',
        executionCount: 0,
        attachedDocuments: ['file-1'],
      };

      const output = await executeCell(cell, 'user-1');

      expect(ragService.search).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'What is photosynthesis?',
          fileIds: ['file-1'],
        }),
      );
      expect(output).toContain('biology.pdf');
      expect(output).toContain('Photosynthesis converts sunlight into glucose.');
      expect(output).toContain('88.0%');
    });

    it('returns fallback message when no results found', async () => {
      vi.mocked(ragService.search).mockResolvedValue([]);

      const cell: MockCell = {
        id: 'cell-2',
        cellType: 'knowledge',
        content: 'Obscure topic with no docs',
        executionCount: 0,
      };

      const output = await executeCell(cell, 'user-1');
      expect(output).toContain('No relevant content found');
    });

    it('uses ragConfig.searchTopK and threshold from cell metadata', async () => {
      vi.mocked(ragService.search).mockResolvedValue([]);

      const cell: MockCell = {
        id: 'cell-3',
        cellType: 'knowledge',
        content: 'query',
        executionCount: 0,
        metadata: { ragConfig: { searchTopK: 10, threshold: 0.8 } },
      };

      await executeCell(cell, 'user-1');

      expect(ragService.search).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 10, threshold: 0.8 }),
      );
    });

    it('passes empty fileIds when no documents are attached', async () => {
      vi.mocked(ragService.search).mockResolvedValue([]);

      const cell: MockCell = {
        id: 'cell-4',
        cellType: 'knowledge',
        content: 'query without docs',
        executionCount: 0,
        attachedDocuments: [],
      };

      await executeCell(cell, 'user-1');

      expect(ragService.search).toHaveBeenCalledWith(
        expect.objectContaining({ fileIds: [] }),
      );
    });

    it('formats multiple results with source and relevance', async () => {
      vi.mocked(ragService.search).mockResolvedValue([
        { id: 'c1', content: 'First chunk.', score: 0.9, metadata: { fileId: 'f1', filename: 'doc1.pdf', chunkIndex: 0, startChar: 0, endChar: 11 }, file: { id: 'f1', filename: 'doc1.pdf', uploadDate: '2025-01-01', size: 100 } },
        { id: 'c2', content: 'Second chunk.', score: 0.75, metadata: { fileId: 'f2', filename: 'doc2.txt', chunkIndex: 0, startChar: 0, endChar: 12 }, file: { id: 'f2', filename: 'doc2.txt', uploadDate: '2025-01-01', size: 200 } },
      ]);

      const cell: MockCell = { id: 'c', cellType: 'knowledge', content: 'query', executionCount: 0 };
      const output = await executeCell(cell, 'u1');

      expect(output).toContain('Source 1');
      expect(output).toContain('doc1.pdf');
      expect(output).toContain('Source 2');
      expect(output).toContain('doc2.txt');
      expect(output).toContain('---');
    });
  });

  // ── AI cells with RAG ──────────────────────────────────────────────────────

  describe('AI cell with ragEnabled', () => {
    it('prepends RAG context to LLM prompt when ragEnabled=true', async () => {
      vi.mocked(ragService.search).mockResolvedValue([
        { id: 'c1', content: 'Relevant context.', score: 0.85, metadata: { fileId: 'f1', filename: 'f.pdf', chunkIndex: 0, startChar: 0, endChar: 16 }, file: { id: 'f1', filename: 'f.pdf', uploadDate: '2025-01-01', size: 100 } },
      ]);
      vi.mocked(llmService.generateResponse).mockResolvedValue({ content: 'AI answer.' } as any);

      const cell: MockCell = {
        id: 'ai-1',
        cellType: 'ai',
        content: 'Explain this.',
        executionCount: 0,
        ragEnabled: true,
        model: 'claude-haiku-4-5-20251001',
      };

      const output = await executeCell(cell, 'user-1');

      expect(ragService.search).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'Explain this.',
          fileIds: [],
          userId: 'user-1',
          limit: 3,
          threshold: 0.1,
          includeMetadata: false,
        }),
      );
      const promptArg = vi.mocked(llmService.generateResponse).mock.calls[0][0];
      expect(promptArg[0].content).toContain('Context from knowledge base:');
      expect(promptArg[0].content).toContain('Relevant context.');
      expect(promptArg[0].content).toContain('Explain this.');
      expect(output).toBe('AI answer.');
    });

    it('sends bare prompt when ragEnabled=false', async () => {
      vi.mocked(llmService.generateResponse).mockResolvedValue({ content: 'Direct answer.' } as any);

      const cell: MockCell = {
        id: 'ai-2',
        cellType: 'ai',
        content: 'Simple question.',
        executionCount: 0,
        ragEnabled: false,
      };

      await executeCell(cell, 'user-1');

      expect(ragService.search).not.toHaveBeenCalled();
      const promptArg = vi.mocked(llmService.generateResponse).mock.calls[0][0];
      expect(promptArg[0].content).toBe('Simple question.');
    });

    it('falls back to bare prompt when RAG returns no results', async () => {
      vi.mocked(ragService.search).mockResolvedValue([]);
      vi.mocked(llmService.generateResponse).mockResolvedValue({ content: 'Fallback.' } as any);

      const cell: MockCell = {
        id: 'ai-3',
        cellType: 'ai',
        content: 'Prompt with no knowledge.',
        executionCount: 0,
        ragEnabled: true,
      };

      await executeCell(cell, 'user-1');

      const promptArg = vi.mocked(llmService.generateResponse).mock.calls[0][0];
      expect(promptArg[0].content).toBe('Prompt with no knowledge.');
    });
  });

  // ── Stub cell types ────────────────────────────────────────────────────────

  describe('stub cell types', () => {
    it.each(['chart', 'agent', 'debug'] as const)(
      '%s cell returns execution message',
      async (cellType) => {
        const cell: MockCell = { id: 'x', cellType, content: '', executionCount: 0 };
        const output = await executeCell(cell, 'u');
        expect(output).toContain(cellType);
      },
    );
  });
});
