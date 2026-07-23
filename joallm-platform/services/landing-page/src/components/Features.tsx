import React from 'react';
import { KnowledgeFlowIllustration } from './PlatformIllustrations';

interface Feature {
  icon: string;
  iconBg: string;
  title: string;
  description: string;
  tags: string[];
  wide?: boolean;
}

const features: Feature[] = [
  {
    icon: '🔍',
    iconBg: 'rgba(139,0,0,0.08)',
    title: 'Knowledge That Becomes Usable',
    description:
      'Upload documents, track indexing, inspect retrieval context, and know when grounded answers are ready for real work.',
    tags: ['Document readiness', 'Source-backed answers', 'Retrieval visibility', 'Grounded chat flow'],
    wide: true,
  },
  {
    icon: '💬',
    iconBg: 'rgba(59,130,246,0.08)',
    title: 'Chat That Connects to the Rest of the System',
    description:
      'Conversations stay connected to knowledge, source inspection, notebooks, and follow-up workflows instead of ending in a single thread.',
    tags: ['Shared sessions', 'Source inspection', 'Model flexibility', 'Context continuity'],
  },
  {
    icon: '⚡',
    iconBg: 'rgba(245,158,11,0.1)',
    title: 'Workflow Automation',
    description:
      'Turn successful prompting into repeatable operations with visual workflows, routing logic, and execution history.',
    tags: ['Visual canvas', 'Conditional routing', 'Execution logic', 'Operational automation'],
  },
  {
    icon: '📓',
    iconBg: 'rgba(34,197,94,0.08)',
    title: 'Notebook Depth',
    description:
      'Use notebooks for structured exploration, knowledge-backed analysis, and longer-form working sessions that need more than chat.',
    tags: ['Mixed cell types', 'Execution flow', 'Knowledge attachment', 'Power-user workspace'],
    wide: true,
  },
  {
    icon: '🏢',
    iconBg: 'rgba(15,23,42,0.08)',
    title: 'Enterprise Workspace Framing',
    description:
      'Give different teams a clearer operating model with workspace modes, cleaner settings, and access that stays understandable.',
    tags: ['Workspace modes', 'Plan visibility', 'Access clarity', 'Unified product language'],
  },
  {
    icon: '🤖',
    iconBg: 'rgba(59,130,246,0.08)',
    title: 'Model Flexibility Without Product Chaos',
    description:
      'Choose across providers and models without losing consistency in the product experience or operational control.',
    tags: ['Multi-provider', 'Model selection', 'Shared UI conventions', 'Enterprise-ready defaults'],
  },
];

export const Features: React.FC = () => {
  return (
    <section id="features" className="lp-section py-24 relative overflow-hidden" style={{ scrollMarginTop: '72px' }}>
      <div className="absolute inset-0 lp-dot-grid" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 xl:grid-cols-[0.9fr_1.1fr] items-start mb-16">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest mb-4 text-joa-primary">Platform Overview</p>
            <h2 className="lp-display font-bold text-joa-dark leading-tight mb-5" style={{ fontSize: 'clamp(2.4rem, 4.8vw, 4rem)' }}>
              One platform from
              <span className="lp-gradient-text"> first answer to repeatable work</span>
            </h2>
            <p className="text-lg text-joa-text max-w-2xl leading-8">
              JoaLLM helps teams move from uploaded knowledge to grounded answers, then from successful prompts to durable workflows.
            </p>
          </div>

          <div className="lp-editorial-panel">
            <div className="lp-editorial-badge">Designed around real activation</div>
            <p className="text-lg text-slate-100 leading-8 max-w-2xl">
              The product is strongest when every surface feels connected: chat, retrieval, notebooks, workflows, and enterprise controls all reinforce the same operating model.
            </p>
            <div className="flex flex-wrap gap-2 mt-6">
              {['Connected workspace', 'Trust-first UX', 'Operational depth'].map((item) => (
                <span key={item} className="lp-editorial-chip">
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mb-14">
          <KnowledgeFlowIllustration />
        </div>

        <div className="lp-bento">
          {features.map((feature) => (
            <div
              key={feature.title}
              className={`lp-feature-card lp-gradient-border p-7 flex flex-col gap-5 ${feature.wide ? 'lp-bento-wide' : ''}`}
            >
              <div className="lp-icon-box" style={{ background: feature.iconBg }}>
                {feature.icon}
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-joa-dark mb-2">{feature.title}</h3>
                <p className="text-sm text-joa-text leading-7">{feature.description}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {feature.tags.map((tag) => (
                  <span key={tag} className="lp-benefit-tag">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-14 flex flex-col sm:flex-row gap-4 justify-center">
          <button className="lp-btn-primary" onClick={() => document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' })}>
            See Guided Demo
          </button>
          <button className="lp-btn-secondary" onClick={() => window.open('https://platform.atrisi.org/', '_blank')}>
            Try Live Platform
          </button>
        </div>
      </div>
    </section>
  );
};
