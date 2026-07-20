import React, { useState } from 'react';

interface RAGMode {
  id: string;
  icon: string;
  iconBg: string;
  accentColor: string;
  label: string;
  tagline: string;
  description: string;
  capabilities: string[];
  tags: string[];
  retrieval: { label: string; value: number; color: string }[];
}

const modes: RAGMode[] = [
  {
    id: 'standard',
    icon: '💬',
    iconBg: 'rgba(59,130,246,0.08)',
    accentColor: '#3B82F6',
    label: 'Standard Assistant',
    tagline: 'Balanced · Fast · Business-ready',
    description:
      'Balanced hybrid retrieval with a business-focused prompt. Delivers direct answers with supporting context in seconds. The right default for most knowledge-base queries.',
    capabilities: [
      'Hybrid vector + keyword retrieval',
      'Source-backed answers with relevance scores',
      'Concise format with key points and next steps',
    ],
    tags: ['Balanced retrieval', 'Fast response', 'General Q&A'],
    retrieval: [
      { label: 'Depth', value: 40, color: '#3B82F6' },
      { label: 'Precision', value: 60, color: '#3B82F6' },
      { label: 'Speed', value: 95, color: '#3B82F6' },
    ],
  },
  {
    id: 'research',
    icon: '🔬',
    iconBg: 'rgba(139,92,246,0.08)',
    accentColor: '#7C3AED',
    label: 'Research Mode',
    tagline: 'Deep · Multi-hop · Lineage-aware',
    description:
      'Two-pass retrieval that uses initial results to expand the search query. Surfaces connections across documents that a single search would miss. Built for complex, multi-part questions.',
    capabilities: [
      'Multi-hop retrieval across up to 25 chunks',
      'Evidence chain with inline [Source N] citations',
      'Cross-document insight synthesis',
    ],
    tags: ['Multi-hop', 'Deep retrieval', 'Evidence chain', 'Due diligence'],
    retrieval: [
      { label: 'Depth', value: 95, color: '#7C3AED' },
      { label: 'Precision', value: 70, color: '#7C3AED' },
      { label: 'Speed', value: 45, color: '#7C3AED' },
    ],
  },
  {
    id: 'compliance',
    icon: '🛡️',
    iconBg: 'rgba(245,158,11,0.08)',
    accentColor: '#D97706',
    label: 'Compliance Mode',
    tagline: 'Strict · Traceable · Explainable',
    description:
      'High-threshold filtering ensures only strongly-matched sources are used. Every claim maps to a verbatim source excerpt. Designed for regulated environments where auditability is non-negotiable.',
    capabilities: [
      'High-confidence threshold — weak matches are excluded',
      'Full source traceability table per claim',
      'Confidence level + limitations + disclaimer',
    ],
    tags: ['Strict filtering', 'Source traceability', 'Audit-ready', 'Regulatory'],
    retrieval: [
      { label: 'Depth', value: 55, color: '#D97706' },
      { label: 'Precision', value: 97, color: '#D97706' },
      { label: 'Speed', value: 65, color: '#D97706' },
    ],
  },
  {
    id: 'decision',
    icon: '⚖️',
    iconBg: 'rgba(34,197,94,0.08)',
    accentColor: '#059669',
    label: 'Decision Mode',
    tagline: 'Multi-source · Structured · Justified',
    description:
      'Wide-net retrieval aggregates evidence across up to 20 chunks from multiple documents. Produces a structured options table, trade-off matrix, and a cited recommendation — not just an answer.',
    capabilities: [
      'Broad aggregation across up to 20 source chunks',
      'Structured output: options, trade-offs, recommendation',
      'Every recommendation backed by ≥2 citations',
    ],
    tags: ['Multi-source', 'Structured output', 'Justified', 'Strategic decisions'],
    retrieval: [
      { label: 'Depth', value: 80, color: '#059669' },
      { label: 'Precision', value: 75, color: '#059669' },
      { label: 'Speed', value: 55, color: '#059669' },
    ],
  },
];

export const RAGModes: React.FC = () => {
  const [activeMode, setActiveMode] = useState<string>('standard');
  const selected = modes.find((m) => m.id === activeMode) ?? modes[0];

  return (
    <section
      id="rag-modes"
      className="lp-section py-24 relative overflow-hidden"
      style={{ scrollMarginTop: '72px' }}
    >
      <div className="absolute inset-0 lp-dot-grid" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-14">
          <p className="text-sm font-semibold uppercase tracking-widest mb-4 text-joa-primary">
            Intelligent Retrieval
          </p>
          <h2
            className="font-bold text-joa-dark leading-tight mb-5"
            style={{ fontSize: 'clamp(2rem, 4.5vw, 3rem)' }}
          >
            Retrieval that adapts to
            <span className="lp-gradient-text"> the weight of the question</span>
          </h2>
          <p className="text-lg text-joa-text max-w-3xl mx-auto leading-8">
            Most RAG systems treat every query the same. JoaLLM ships four purpose-built retrieval
            modes — each tuned for a different combination of depth, precision, and output structure.
          </p>
        </div>

        {/* Mode tabs */}
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          {modes.map((m) => (
            <button
              key={m.id}
              onClick={() => setActiveMode(m.id)}
              className="flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-all"
              style={
                activeMode === m.id
                  ? {
                      borderColor: m.accentColor,
                      background: `${m.accentColor}14`,
                      color: m.accentColor,
                    }
                  : {
                      borderColor: 'rgba(0,0,0,0.1)',
                      background: '#ffffff',
                      color: '#64748b',
                    }
              }
            >
              <span>{m.icon}</span>
              <span>{m.label}</span>
            </button>
          ))}
        </div>

        {/* Detail card */}
        <div className="lp-glass-card lp-gradient-border p-8 mb-10 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          {/* Left: description + capabilities */}
          <div className="flex flex-col gap-6">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="lp-icon-box text-2xl" style={{ background: selected.iconBg }}>
                  {selected.icon}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-joa-dark">{selected.label}</h3>
                  <p className="text-sm font-medium" style={{ color: selected.accentColor }}>
                    {selected.tagline}
                  </p>
                </div>
              </div>
              <p className="text-joa-text leading-7">{selected.description}</p>
            </div>

            <ul className="space-y-3">
              {selected.capabilities.map((cap) => (
                <li key={cap} className="flex items-start gap-3">
                  <span
                    className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold"
                    style={{ background: selected.accentColor }}
                  >
                    ✓
                  </span>
                  <span className="text-sm text-joa-text leading-6">{cap}</span>
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap gap-1.5 mt-auto">
              {selected.tags.map((tag) => (
                <span key={tag} className="lp-benefit-tag">
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Right: retrieval profile bars */}
          <div className="flex flex-col justify-center gap-6 lg:pl-8 lg:border-l lg:border-gray-100">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
              Retrieval profile
            </p>
            {selected.retrieval.map((bar) => (
              <div key={bar.label}>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-sm font-medium text-joa-dark">{bar.label}</span>
                  <span className="text-sm font-semibold" style={{ color: bar.color }}>
                    {bar.value}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${bar.value}%`, background: bar.color }}
                  />
                </div>
              </div>
            ))}

            <div
              className="mt-4 rounded-xl p-4 text-sm leading-6"
              style={{ background: `${selected.accentColor}0d`, color: selected.accentColor }}
            >
              <strong>Best for:</strong>{' '}
              {selected.id === 'standard' && 'General knowledge-base Q&A, support queries, and everyday document search.'}
              {selected.id === 'research' && 'Due diligence, literature review, and multi-part questions that span several documents.'}
              {selected.id === 'compliance' && 'Regulatory queries, audit evidence, legal document review, and policy Q&A.'}
              {selected.id === 'decision' && 'Vendor selection, strategic trade-off analysis, and evidence-backed recommendations.'}
            </div>
          </div>
        </div>

        {/* 4-card summary grid */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-12">
          {modes.map((m) => (
            <button
              key={m.id}
              onClick={() => setActiveMode(m.id)}
              className={`lp-glass-card p-5 text-left flex flex-col gap-3 transition-all ${
                activeMode === m.id ? 'lp-gradient-border' : ''
              }`}
              style={activeMode === m.id ? { boxShadow: `0 0 0 1.5px ${m.accentColor}40` } : {}}
            >
              <div className="lp-icon-box" style={{ background: m.iconBg }}>
                {m.icon}
              </div>
              <div>
                <h4 className="text-sm font-semibold text-joa-dark">{m.label}</h4>
                <p className="text-xs mt-1 leading-5" style={{ color: m.accentColor }}>
                  {m.tagline}
                </p>
              </div>
              <p className="text-xs text-joa-text leading-5 line-clamp-3">{m.description}</p>
            </button>
          ))}
        </div>

        <div className="text-center flex flex-col sm:flex-row gap-4 justify-center">
          <button
            className="lp-btn-primary"
            onClick={() => window.open('https://platform.joallm.ai/', '_blank')}
          >
            Try it on your documents
          </button>
          <button
            className="lp-btn-secondary"
            onClick={() => document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' })}
          >
            See guided demo
          </button>
        </div>
      </div>
    </section>
  );
};
