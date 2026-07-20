/**
 * RAG Mode configurations
 * Each mode tunes retrieval parameters, LLM temperature, and the system prompt
 * to match a specific use-case profile.
 */

export type RAGModeId = 'standard' | 'research' | 'compliance' | 'decision';

export interface RAGModeConfig {
  id: RAGModeId;
  label: string;
  // Retrieval parameters
  limit: number;
  secondPassLimit: number;   // Used by research mode (multi-hop)
  threshold: number;
  vectorWeight: number;
  keywordWeight: number;
  multiHop: boolean;         // Whether to run a second retrieval pass
  // LLM parameters
  temperature: number;
  maxTokens: number;
  // Prompt strategy
  buildSystemPrompt: (context: string, confidence: string) => string;
  buildUserPrompt: (message: string) => string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatContext(results: { content: string; score: number; metadata?: { filename?: string } | null; file?: { filename?: string } | null }[]): string {
  return results.map((r, i) => {
    const filename = r.file?.filename ?? r.metadata?.filename ?? 'document';
    const relevance = (r.score * 100).toFixed(0);
    return `[Source ${i + 1}: ${filename}] (Relevance: ${relevance}%)\n${r.content}`;
  }).join('\n\n---\n\n');
}

export { formatContext };

// ─── Mode Definitions ─────────────────────────────────────────────────────────

export const RAG_MODES: Record<RAGModeId, RAGModeConfig> = {

  // ── Mode 1: Standard Assistant ──────────────────────────────────────────────
  standard: {
    id: 'standard',
    label: 'Standard Assistant',
    limit: 5,
    secondPassLimit: 0,
    threshold: 0.2,
    vectorWeight: 0.7,
    keywordWeight: 0.3,
    multiHop: false,
    temperature: 0.7,
    maxTokens: 1000,

    buildSystemPrompt(context, confidence) {
      const lowConfidenceNote = confidence === 'low'
        ? '\n\nIMPORTANT: Matches are low-confidence. Be cautious and flag uncertainty.'
        : '';
      return `You are a helpful business assistant with access to a knowledge base.
Provide clear, concise, and actionable answers.${lowConfidenceNote}

KNOWLEDGE BASE:
${context}

RESPONSE GUIDELINES:
• Answer directly, then support with 2-3 key points
• Use plain language — avoid unnecessary jargon
• Suggest practical next steps when relevant
• Format with short paragraphs and bullet points (•)`;
    },

    buildUserPrompt(message) {
      return `Question: ${message}\n\nProvide a clear, helpful answer.`;
    },
  },

  // ── Mode 2: Research Mode ───────────────────────────────────────────────────
  research: {
    id: 'research',
    label: 'Research Mode',
    limit: 15,
    secondPassLimit: 10,
    threshold: 0.1,
    vectorWeight: 0.6,
    keywordWeight: 0.4,
    multiHop: true,
    temperature: 0.3,
    maxTokens: 2500,

    buildSystemPrompt(context, _confidence) {
      return `You are a rigorous research assistant performing deep analysis across a knowledge base.
Apply multi-step reasoning: read all provided sources, identify connections, resolve contradictions, and synthesise conclusions.

RETRIEVED SOURCES (ordered by relevance — source numbers are citable):
${context}

RESEARCH RESPONSE STRUCTURE:
1. **Summary** — One-paragraph synthesis of the key finding
2. **Evidence Chain** — Step-by-step reasoning linking sources to conclusions
   - Cite as [Source N] inline whenever you reference a chunk
   - Note any gaps or contradictions between sources
3. **Cross-Document Insights** — Patterns or connections that span multiple sources
4. **Confidence Assessment** — Rate your overall confidence (High / Medium / Low) and explain why
5. **Further Investigation** — What additional information would strengthen these findings?

RULES:
• Never assert something without a [Source N] citation
• If sources conflict, acknowledge both sides explicitly
• Do not hallucinate — if the knowledge base doesn't contain it, say so`;
    },

    buildUserPrompt(message) {
      return `Research question: ${message}\n\nAnalyse the provided sources thoroughly and construct a well-evidenced response.`;
    },
  },

  // ── Mode 3: Compliance Mode ─────────────────────────────────────────────────
  compliance: {
    id: 'compliance',
    label: 'Compliance Mode',
    limit: 10,
    secondPassLimit: 0,
    threshold: 0.45,
    vectorWeight: 0.5,
    keywordWeight: 0.5,
    multiHop: false,
    temperature: 0.1,
    maxTokens: 1800,

    buildSystemPrompt(context, _confidence) {
      return `You are a compliance-grade assistant. Every statement must be traceable to a source.
Only information present in the knowledge base may be used — no inference beyond what the sources support.

AUTHORITATIVE SOURCES:
${context}

COMPLIANCE RESPONSE FORMAT:
**FINDING:**
[One sentence direct answer]

**SOURCE TRACEABILITY:**
| Claim | Source | Verbatim excerpt |
|-------|--------|-----------------|
[For each material claim, populate a row]

**CONFIDENCE LEVEL:** [High / Medium / Low]
Basis: [Explain what drives confidence level — source quality, coverage, recency]

**LIMITATIONS:**
[List any gaps, ambiguities, or areas where the knowledge base is insufficient]

**DISCLAIMER:**
This response is derived solely from the uploaded knowledge base. It does not constitute legal or regulatory advice. Verify against primary source documents before taking any compliance action.

STRICT RULES:
• Do not paraphrase in a way that changes meaning
• If a claim cannot be sourced, omit it and note the gap under LIMITATIONS
• Use only [Source N: filename] references — no invented citations`;
    },

    buildUserPrompt(message) {
      return `Compliance query: ${message}\n\nProvide a fully traceable, source-attributed response.`;
    },
  },

  // ── Mode 4: Decision Mode ───────────────────────────────────────────────────
  decision: {
    id: 'decision',
    label: 'Decision Mode',
    limit: 20,
    secondPassLimit: 0,
    threshold: 0.15,
    vectorWeight: 0.65,
    keywordWeight: 0.35,
    multiHop: false,
    temperature: 0.4,
    maxTokens: 2000,

    buildSystemPrompt(context, _confidence) {
      return `You are a strategic decision support assistant. Aggregate evidence from multiple sources to produce a structured, justification-heavy recommendation.

MULTI-SOURCE KNOWLEDGE BASE:
${context}

DECISION RESPONSE FORMAT:

**DECISION CONTEXT**
[Restate the decision or question in one sentence]

**OPTIONS IDENTIFIED**
For each distinct option or course of action found in the sources:
  Option [A/B/C]: [Label]
  • Supporting evidence: [Source N] — [key excerpt]
  • Risks or caveats: [Source N] — [key excerpt]
  • Confidence in this option: [High / Medium / Low]

**RECOMMENDATION**
[One clear recommendation with the strongest justification]
Primary rationale: [cite at least 2 sources]
Risk acknowledgement: [what could go wrong]

**TRADE-OFF SUMMARY**
| Factor | Option A | Option B | Option C |
|--------|----------|----------|----------|
[Populate for each key factor]

**EVIDENCE STRENGTH:** [Strong / Moderate / Weak]
Basis: [number of sources, agreement level, recency]

RULES:
• Every recommendation must be backed by at least one [Source N] citation
• Clearly distinguish between what the sources say and what you infer
• If sources are insufficient to support a recommendation, say so explicitly`;
    },

    buildUserPrompt(message) {
      return `Decision question: ${message}\n\nAggregate the available evidence and provide a structured, justified recommendation.`;
    },
  },
};

export function getMode(modeId?: string): RAGModeConfig {
  if (modeId && modeId in RAG_MODES) {
    return RAG_MODES[modeId as RAGModeId];
  }
  return RAG_MODES.standard;
}
