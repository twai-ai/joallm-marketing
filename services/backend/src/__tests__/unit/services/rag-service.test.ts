/**
 * Unit tests for RAGService
 *
 * search() now delegates to enhancedRAGService and maps the result to
 * the narrower RAGSearchResult interface. Tests verify the mapping and
 * error propagation; search quality is covered by enhanced-rag-service tests.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock dependencies ────────────────────────────────────────────────────────

vi.mock('../../../database/connection.js', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../../../services/embedding-service.js', () => ({
  embeddingService: {
    generateQueryEmbedding: vi.fn(),
    generateQueryEmbeddingFull: vi.fn(),
    generateEmbeddings: vi.fn(),
    calculateCosineSimilarity: vi.fn(),
  },
}));

vi.mock('../../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../../services/enhanced-rag-service.js', () => ({
  enhancedRAGService: {
    search: vi.fn(),
  },
}));

import { RAGService } from '../../../services/rag-service.js';
import { enhancedRAGService } from '../../../services/enhanced-rag-service.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeEnhancedResult(overrides: Record<string, unknown> = {}) {
  return {
    id: 'chunk-1',
    content: 'The mitochondria is the powerhouse of the cell.',
    score: 0.92,
    vectorScore: 0.92,
    keywordScore: 0.85,
    metadata: {
      fileId: 'file-1',
      filename: 'biology.pdf',
      chunkIndex: 0,
      pageNumber: 1,
      startChar: 0,
      endChar: 46,
    },
    file: {
      id: 'file-1',
      filename: 'biology.pdf',
      uploadDate: '2025-01-01T00:00:00.000Z',
      size: 1024,
      mimetype: 'application/pdf',
    },
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('RAGService', () => {
  let service: RAGService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new RAGService();
  });

  describe('search()', () => {
    it('maps EnhancedRAGSearchResult to RAGSearchResult shape', async () => {
      const enhanced = makeEnhancedResult();
      vi.mocked(enhancedRAGService.search).mockResolvedValue([enhanced] as any);

      const results = await service.search({ query: 'cell biology' });

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        id: 'chunk-1',
        content: 'The mitochondria is the powerhouse of the cell.',
        score: 0.92,
        metadata: {
          fileId: 'file-1',
          filename: 'biology.pdf',
          chunkIndex: 0,
          pageNumber: 1,
          startChar: 0,
          endChar: 46,
        },
        file: {
          id: 'file-1',
          filename: 'biology.pdf',
          uploadDate: '2025-01-01T00:00:00.000Z',
          size: 1024,
        },
      });
      // mimetype and vectorScore/keywordScore should not appear in mapped result
      expect((results[0] as any).vectorScore).toBeUndefined();
      expect((results[0].file as any).mimetype).toBeUndefined();
    });

    it('returns empty array when enhancedRAGService returns no results', async () => {
      vi.mocked(enhancedRAGService.search).mockResolvedValue([]);

      const results = await service.search({ query: 'anything' });
      expect(results).toHaveLength(0);
    });

    it('propagates errors from enhancedRAGService as RAG search failed', async () => {
      vi.mocked(enhancedRAGService.search).mockRejectedValue(new Error('upstream failure'));

      await expect(service.search({ query: 'test' })).rejects.toThrow(/search failed/i);
    });

    it('passes query, fileIds, limit, and threshold through to enhancedRAGService', async () => {
      vi.mocked(enhancedRAGService.search).mockResolvedValue([]);

      await service.search({ query: 'test', fileIds: ['f1', 'f2'], limit: 3, threshold: 0.8 });

      expect(enhancedRAGService.search).toHaveBeenCalledWith({
        query: 'test',
        fileIds: ['f1', 'f2'],
        limit: 3,
        threshold: 0.8,
      });
    });

    it('maps multiple results preserving order from enhancedRAGService', async () => {
      const enhanced = [
        makeEnhancedResult({ id: 'c1', score: 0.95 }),
        makeEnhancedResult({ id: 'c2', score: 0.85 }),
        makeEnhancedResult({ id: 'c3', score: 0.75 }),
      ];
      vi.mocked(enhancedRAGService.search).mockResolvedValue(enhanced as any);

      const results = await service.search({ query: 'test', threshold: 0.0 });
      expect(results.map(r => r.id)).toEqual(['c1', 'c2', 'c3']);
    });
  });
});
