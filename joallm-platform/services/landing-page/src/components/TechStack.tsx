import React from 'react';

interface TechCategory {
  icon: string;
  iconBg: string;
  title: string;
  description: string;
  tags: string[];
}

const categories: TechCategory[] = [
  {
    icon: '⚛️',
    iconBg: 'rgba(59,130,246,0.08)',
    title: 'Frontend',
    description: 'React 19 + TypeScript interface with Vite, Tailwind CSS, and React Query.',
    tags: ['React 19', 'TypeScript', 'Tailwind CSS', 'Vite', 'React Query'],
  },
  {
    icon: '🚀',
    iconBg: 'rgba(139,0,0,0.08)',
    title: 'Backend',
    description: 'Node.js 20 API layer built on Fastify — schema-validated at every endpoint with Zod.',
    tags: ['Node.js 20', 'Fastify', 'TypeScript', 'Drizzle ORM', 'Zod'],
  },
  {
    icon: '🗄️',
    iconBg: 'rgba(139,0,0,0.08)',
    title: 'Database',
    description: 'PostgreSQL 14+ with native pgvector cosine search and full-text search via tsvector.',
    tags: ['PostgreSQL 14+', 'pgvector (<=>) ', 'Full-Text Search', 'Redis', 'BullMQ'],
  },
  {
    icon: '🤖',
    iconBg: 'rgba(245,158,11,0.1)',
    title: 'AI / ML',
    description: '4 LLM providers, Cohere embeddings (1024-dim), streaming APIs with accurate token counting.',
    tags: ['OpenAI GPT-4o', 'Claude 4', 'Groq (Ultra-Fast)', 'Ollama (Local)', 'Cohere Embeddings'],
  },
  {
    icon: '☁️',
    iconBg: 'rgba(59,130,246,0.08)',
    title: 'Storage',
    description: 'Cloud-native file storage with background processing queue for document chunking and indexing.',
    tags: ['Cloudflare R2', 'AWS S3', 'BullMQ Jobs', 'pgvector Index'],
  },
  {
    icon: '🔐',
    iconBg: 'rgba(34,197,94,0.08)',
    title: 'Security',
    description: '2FA enforcement at token level, account lockout, password reset, RBAC, and audit logging.',
    tags: ['2FA Enforcement', 'Account Lockout', 'JWT + Refresh', 'RBAC (5 tiers)', 'Audit Logs'],
  },
];

const architectureLayers = [
  { label: 'React Frontend', icon: '⚛️', sub: 'TypeScript + Tailwind', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.2)' },
  { label: 'Fastify API', icon: '🚀', sub: 'Node.js 20 + Drizzle ORM', bg: 'rgba(139,0,0,0.08)', border: 'rgba(139,0,0,0.2)' },
  { label: 'PostgreSQL + pgvector', icon: '🗄️', sub: 'Vector + full-text search', bg: 'rgba(139,0,0,0.08)', border: 'rgba(139,0,0,0.2)' },
];

const supportItems = [
  { icon: '🤖', label: 'LLM APIs', sub: 'OpenAI, Anthropic, Groq', bg: 'rgba(245,158,11,0.07)' },
  { icon: '☁️', label: 'File Storage', sub: 'R2 / S3', bg: 'rgba(59,130,246,0.06)' },
  { icon: '⚡', label: 'Redis + BullMQ', sub: 'Queue & jobs', bg: 'rgba(34,197,94,0.07)' },
  { icon: '🔐', label: 'Security Layer', sub: '2FA · RBAC · Audit', bg: 'rgba(139,0,0,0.06)' },
];

const benefits = [
  {
    icon: '⚡',
    title: 'High Performance',
    desc: 'Fastify API with native pgvector — queries stay inside Postgres, no round-trip to an external vector DB.',
  },
  {
    icon: '🔒',
    title: 'Secure by Default',
    desc: '2FA enforcement, account lockout, password reset, 5-tier RBAC, and a full audit log trail — all live.',
  },
  {
    icon: '📈',
    title: 'Production Scalable',
    desc: 'Cloud-native storage, BullMQ background jobs, Redis caching, and containerised with Docker.',
  },
];

export const TechStack: React.FC = () => {
  return (
    <section id="tech" className="lp-section py-24 relative overflow-hidden" style={{ scrollMarginTop: '72px' }}>
      <div className="absolute inset-0 lp-dot-grid" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-14">
          <p className="text-sm font-semibold uppercase tracking-widest mb-4 text-joa-primary">
            Technology
          </p>
          <h2
            className="font-bold text-joa-dark leading-tight mb-4"
            style={{ fontSize: 'clamp(2rem, 4.5vw, 3rem)' }}
          >
            Built with
            <span className="lp-gradient-text"> modern technology</span>
          </h2>
          <p className="text-lg text-joa-text max-w-2xl mx-auto">
            A robust, production-proven stack — every piece chosen for performance, reliability,
            and developer experience.
          </p>
        </div>

        {/* Tech categories */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
          {categories.map(c => (
            <div key={c.title} className="lp-glass-card p-6 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="lp-icon-box" style={{ background: c.iconBg }}>{c.icon}</div>
                <h3 className="font-semibold text-joa-dark">{c.title}</h3>
              </div>
              <p className="text-sm text-joa-text leading-relaxed">{c.description}</p>
              <div className="flex flex-wrap gap-1.5 mt-auto">
                {c.tags.map(tag => (
                  <span key={tag} className="lp-tech-pill">{tag}</span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Architecture diagram */}
        <div className="lp-glass-card p-8 mb-12">
          <h3 className="text-lg font-semibold text-joa-dark text-center mb-8">System Architecture</h3>

          <div className="flex flex-col md:flex-row items-center justify-center gap-4 mb-8">
            {architectureLayers.map((layer, i) => (
              <React.Fragment key={layer.label}>
                <div
                  className="rounded-xl px-6 py-4 text-center min-w-[160px]"
                  style={{ background: layer.bg, border: `1px solid ${layer.border}` }}
                >
                  <div className="text-2xl mb-1">{layer.icon}</div>
                  <div className="text-sm font-semibold text-joa-dark">{layer.label}</div>
                  <div className="text-xs text-joa-text mt-0.5">{layer.sub}</div>
                </div>
                {i < architectureLayers.length - 1 && (
                  <div className="text-xl rotate-90 md:rotate-0 text-gray-300">→</div>
                )}
              </React.Fragment>
            ))}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {supportItems.map(s => (
              <div
                key={s.label}
                className="rounded-xl p-4 text-center border border-gray-100"
                style={{ background: s.bg }}
              >
                <div className="text-xl mb-1">{s.icon}</div>
                <div className="text-xs font-semibold text-joa-dark">{s.label}</div>
                <div className="text-xs text-joa-text mt-0.5">{s.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Benefits */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {benefits.map(b => (
            <div key={b.title} className="text-center px-4">
              <div className="text-3xl mb-3">{b.icon}</div>
              <h4 className="font-semibold text-joa-dark mb-2">{b.title}</h4>
              <p className="text-sm text-joa-text leading-relaxed">{b.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
