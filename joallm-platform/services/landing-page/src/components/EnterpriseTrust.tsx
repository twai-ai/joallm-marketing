import React from 'react';
import { BarChart3, LockKeyhole, Shield, Workflow } from 'lucide-react';

const trustPoints = [
  {
    title: 'Governed Access',
    description: 'Workspace preferences on the frontend, backend permissions for actual authority, and a clearer path to enterprise RBAC.',
    icon: Shield,
  },
  {
    title: 'Grounded Answers',
    description: 'Document-aware answers with inspectable sources, readiness states, and a cleaner path from upload to verified response.',
    icon: LockKeyhole,
  },
  {
    title: 'Operational Depth',
    description: 'Workflows and notebooks turn successful AI usage into reusable team processes instead of isolated chats.',
    icon: Workflow,
  },
  {
    title: 'Usage Visibility',
    description: 'Plans, limits, and cost/usage surfaces make the system feel accountable enough for real business adoption.',
    icon: BarChart3,
  },
];

export const EnterpriseTrust: React.FC = () => {
  return (
    <section id="security" className="lp-section-alt py-24 relative overflow-hidden" style={{ scrollMarginTop: '72px' }}>
      <div className="absolute inset-0 lp-line-grid" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
          <div className="space-y-6">
            <p className="text-sm font-semibold uppercase tracking-widest text-joa-primary">Enterprise Trust</p>
            <h2 className="font-bold text-joa-dark leading-tight" style={{ fontSize: 'clamp(2rem, 4.2vw, 3rem)' }}>
              Built to feel
              <span className="lp-gradient-text block">safe, legible, and operational</span>
            </h2>
            <p className="text-lg leading-8 text-joa-text">
              Enterprise buyers do not convert on feature count alone. They convert when the product feels understandable, governable, and compatible with the way teams actually work.
            </p>

            <div className="lp-proof-panel">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="lp-proof-stat">
                  <span className="lp-proof-value">RBAC</span>
                  <span className="lp-proof-label">Backend-driven permissions are becoming first-class</span>
                </div>
                <div className="lp-proof-stat">
                  <span className="lp-proof-value">RAG</span>
                  <span className="lp-proof-label">Grounded answers with inspectable source context</span>
                </div>
                <div className="lp-proof-stat">
                  <span className="lp-proof-value">Usage</span>
                  <span className="lp-proof-label">Plan, limits, and cost surfaces visible in product</span>
                </div>
                <div className="lp-proof-stat">
                  <span className="lp-proof-value">Flow</span>
                  <span className="lp-proof-label">One platform connecting chat, knowledge, notebooks, and workflows</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            {trustPoints.map((point) => (
              <div key={point.title} className="lp-glass-card p-6">
                <div className="lp-icon-box mb-5" style={{ background: 'rgba(59, 130, 246, 0.08)' }}>
                  <point.icon className="h-5 w-5 text-joa-accent" />
                </div>
                <h3 className="text-base font-semibold text-joa-dark">{point.title}</h3>
                <p className="mt-3 text-sm leading-7 text-joa-text">{point.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
