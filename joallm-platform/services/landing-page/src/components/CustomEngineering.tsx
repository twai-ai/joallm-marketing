import React from 'react';

const checkItems = [
  {
    title: 'Custom Integrations',
    desc: 'Connect JoaLLM to your internal tools, databases, or third-party APIs.',
  },
  {
    title: 'Tailored Workflows',
    desc: 'Design conditional AI pipelines that map exactly to your business logic.',
  },
  {
    title: 'Dedicated Support',
    desc: 'A dedicated engineering team guides you from scoping to production deployment.',
  },
];

const steps = [
  { label: 'Requirements Scoping', pct: '85%', color: 'var(--joa-primary)' },
  { label: 'Custom Development', pct: '70%', color: 'var(--joa-accent)' },
  { label: 'Integration & Testing', pct: '80%', color: 'var(--joa-primary)' },
  { label: 'Deployment & Support', pct: '90%', color: 'var(--joa-accent)' },
];

export const CustomEngineering: React.FC = () => {
  return (
    <section className="lp-section-alt py-24 relative overflow-hidden">
      <div className="absolute inset-0 lp-line-grid" />
      <div
        className="lp-orb absolute pointer-events-none"
        style={{
          width: 400,
          height: 400,
          top: '-10%',
          right: '-5%',
          background: 'radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 65%)',
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
          {/* Content */}
          <div>
            <div className="lp-badge inline-flex mb-6">⚙️&nbsp; Custom Solutions</div>

            <h2
              className="font-bold text-joa-dark leading-tight mb-5"
              style={{ fontSize: 'clamp(2rem, 4vw, 2.8rem)' }}
            >
              Engineered for
              <span className="lp-gradient-text block">your specific needs</span>
            </h2>

            <p className="text-lg text-joa-text leading-relaxed mb-8">
              Every business is different. Off-the-shelf AI rarely fits without friction.
              We build custom solutions — integrations, workflows, and deployments — scoped
              precisely to your requirements.
            </p>

            <div className="flex flex-col gap-5 mb-10">
              {checkItems.map(item => (
                <div key={item.title} className="flex items-start gap-4">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: 'rgba(139,0,0,0.1)', border: '1px solid rgba(139,0,0,0.25)' }}
                  >
                    <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
                      <path
                        d="M2 6.5L4.5 9L10 3"
                        stroke="#8B0000"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-joa-dark text-sm mb-0.5">{item.title}</h3>
                    <p className="text-sm text-joa-text">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <button
                className="lp-btn-primary"
                onClick={() =>
                  window.open('mailto:support@joallm.ai?subject=Custom Engineering Inquiry', '_blank')
                }
              >
                Discuss Your Needs →
              </button>
              <button
                className="lp-btn-secondary"
                onClick={() =>
                  window.open('mailto:support@joallm.ai?subject=Request Consultation', '_blank')
                }
              >
                Schedule Consultation
              </button>
            </div>
          </div>

          {/* Visual card */}
          <div className="lp-glass-card lp-gradient-border p-8">
            <div className="text-center mb-7">
              <div className="text-4xl mb-3">🎯</div>
              <h3 className="font-semibold text-joa-dark mb-1">Custom AI Solutions</h3>
              <p className="text-sm text-joa-text">Built specifically for your business</p>
            </div>

            <div className="flex flex-col gap-5">
              {steps.map(step => (
                <div key={step.label}>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-sm text-joa-dark">{step.label}</span>
                    <span className="text-xs text-joa-text">{step.pct}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-100">
                    <div
                      className="h-1.5 rounded-full"
                      style={{ width: step.pct, background: step.color }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div
              className="mt-8 rounded-xl p-4 text-center"
              style={{ background: 'rgba(139,0,0,0.06)', border: '1px solid rgba(139,0,0,0.12)' }}
            >
              <p className="text-sm text-joa-primary">
                Average time from scoping to production: <strong>4–8 weeks</strong>
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
