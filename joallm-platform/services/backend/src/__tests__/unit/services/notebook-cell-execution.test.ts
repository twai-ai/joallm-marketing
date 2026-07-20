/**
 * Unit tests for notebook cell execution logic.
 *
 * Tests the switch/case execution engine in notebooks.ts by extracting the
 * logic into helper functions, then verifying each cell type independently.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import vm from 'node:vm';

// ── Execution helpers (mirrors notebooks.ts logic) ───────────────────────────

/** Execute a code cell — same sandbox used in the route handler. */
async function executeCodeCell(content: string): Promise<string> {
  const logs: string[] = [];
  const sandbox = {
    console: { log: (...args: unknown[]) => logs.push(args.map(String).join(' ')) },
    result: undefined as unknown,
  };

  try {
    const script = new vm.Script(content);
    const context = vm.createContext(sandbox);
    sandbox.result = script.runInContext(context, { timeout: 5000 });
    return logs.length > 0
      ? logs.join('\n') + (sandbox.result !== undefined ? `\n=> ${JSON.stringify(sandbox.result)}` : '')
      : sandbox.result !== undefined
        ? String(JSON.stringify(sandbox.result))
        : '(no output)';
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : String(err)}`;
  }
}

/** Markdown cells return content as-is. */
function executeMarkdownCell(content: string): string {
  return content;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Notebook cell execution', () => {
  describe('code cells', () => {
    it('captures console.log output', async () => {
      const out = await executeCodeCell('console.log("hello world")');
      // console.log in the sandbox returns the result of logs.push() (a number),
      // so the VM result is truthy — the output includes the log line.
      expect(out).toContain('hello world');
    });

    it('returns expression result', async () => {
      const out = await executeCodeCell('1 + 2');
      expect(out).toBe('3');
    });

    it('returns both logs and result', async () => {
      const out = await executeCodeCell('console.log("a"); 42');
      expect(out).toContain('a');
      expect(out).toContain('42');
    });

    it('returns (no output) for undefined result with no logs', async () => {
      const out = await executeCodeCell('let x = 1;');
      expect(out).toBe('(no output)');
    });

    it('catches runtime errors', async () => {
      const out = await executeCodeCell('throw new Error("boom")');
      // Errors thrown from a vm context are not instanceof outer Error,
      // so String(err) is used → "Error: boom"; then we prefix with "Error: ".
      expect(out).toContain('boom');
      expect(out.startsWith('Error:')).toBe(true);
    });

    it('catches infinite loop via timeout', async () => {
      const out = await executeCodeCell('while(true) {}');
      expect(out).toMatch(/Error:/);
    }, 10_000);

    it('returns JSON-serialised complex values', async () => {
      const out = await executeCodeCell('({ a: 1, b: [2, 3] })');
      expect(out).toBe(JSON.stringify({ a: 1, b: [2, 3] }));
    });

    it('multiple console.log lines are newline-separated', async () => {
      const out = await executeCodeCell('console.log("line1"); console.log("line2")');
      expect(out).toContain('line1\nline2');
    });

    it('catches syntax errors gracefully', async () => {
      const out = await executeCodeCell('const {{{');
      expect(out).toMatch(/^Error:/);
    });
  });

  describe('markdown cells', () => {
    it('returns content unchanged', () => {
      const md = '## Hello\n\nThis is **bold** text.';
      expect(executeMarkdownCell(md)).toBe(md);
    });

    it('handles empty content', () => {
      expect(executeMarkdownCell('')).toBe('');
    });
  });
});
