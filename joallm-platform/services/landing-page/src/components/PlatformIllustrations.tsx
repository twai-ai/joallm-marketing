import React from 'react';
import { ArrowRightLeft, BookOpenText, BrainCircuit, ShieldCheck, Workflow } from 'lucide-react';

interface IllustrationProps {
  className?: string;
}

const journeySteps = [
  {
    title: 'Knowledge intake',
    copy: 'Upload PDFs, docs, and internal material into a workspace that keeps readiness visible.',
    stat: '35+ formats',
    icon: BookOpenText,
  },
  {
    title: 'Model orchestration',
    copy: 'Choose the right model path without breaking continuity across chat, notebooks, and workflows.',
    stat: '20+ models',
    icon: BrainCircuit,
  },
  {
    title: 'Governed execution',
    copy: 'Operationalize proven prompts as repeatable workflows with enterprise visibility built in.',
    stat: 'Workflow ready',
    icon: Workflow,
  },
];

export const HeroPlatformIllustration: React.FC<IllustrationProps> = ({ className = '' }) => {
  return (
    <div className={`lp-showcase-shell ${className}`}>
      <div className="lp-showcase-backdrop" />

      <div className="lp-showcase-panel">
        <div className="lp-showcase-window">
          <div className="lp-showcase-window-bar">
            <div className="flex items-center gap-2">
              <span className="lp-window-dot bg-[#fb7185]" />
              <span className="lp-window-dot bg-[#fbbf24]" />
              <span className="lp-window-dot bg-[#4ade80]" />
            </div>
            <span>JoaLLM command center</span>
            <span className="lp-window-status">Live workspace</span>
          </div>

          <div className="lp-showcase-grid">
            <div className="lp-showcase-main">
              <div className="lp-showcase-brand">
                <div>
                  <p className="lp-brand-overline">Branded AI workspace</p>
                  <h3 className="lp-showcase-title">The build should look like a category-defining platform, not a utility dashboard.</h3>
                </div>
                <img src="/JoaLLM-logo-standard.png" alt="JoaLLM workspace branding" className="lp-showcase-logo-art" />
              </div>

              <div className="lp-showcase-strip">
                <span>Chat</span>
                <span>Knowledge</span>
                <span>Notebooks</span>
                <span>Workflows</span>
              </div>

              <div className="lp-showcase-metrics">
                {[
                  ['4 source matches', 'Grounded result'],
                  ['2 docs indexing', 'Readiness signal'],
                  ['1 workflow drafted', 'Operational next step'],
                ].map(([value, label]) => (
                  <div key={label} className="lp-showcase-metric">
                    <p>{value}</p>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="lp-showcase-side">
              <div className="lp-showcase-side-card lp-showcase-side-dark">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="lp-brand-overline text-blue-200">Routing</p>
                    <h4 className="text-white font-semibold text-lg">Multi-model flow</h4>
                  </div>
                  <ArrowRightLeft className="h-5 w-5 text-blue-200" />
                </div>
                <div className="lp-showcase-badges">
                  <span>OpenAI</span>
                  <span>Anthropic</span>
                  <span>Groq</span>
                  <span>Ollama</span>
                </div>
              </div>

              <div className="lp-showcase-side-card">
                <div className="flex items-center gap-3 mb-3">
                  <ShieldCheck className="h-5 w-5 text-joa-primary" />
                  <div>
                    <p className="lp-brand-overline">Enterprise trust</p>
                    <h4 className="text-joa-dark font-semibold">Security and control stay visible</h4>
                  </div>
                </div>
                <ul className="lp-showcase-list">
                  <li>Role-based access</li>
                  <li>Workspace modes</li>
                  <li>Audit-ready product framing</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="lp-showcase-floating lp-showcase-floating-left">
          <img src="/JoaLLM-logo-2-logo.png" alt="JoaLLM emblem" className="lp-showcase-floating-logo" />
          <div>
            <p className="lp-brand-overline">Visual identity</p>
            <p className="font-semibold text-joa-dark">A more recognizable branded surface</p>
          </div>
        </div>

        <div className="lp-showcase-floating lp-showcase-floating-right">
          <p className="lp-brand-overline">Best first journey</p>
          <p className="font-semibold text-slate-50">Upload → Ask → Verify → Operationalize</p>
        </div>
      </div>
    </div>
  );
};

export const KnowledgeFlowIllustration: React.FC<IllustrationProps> = ({ className = '' }) => {
  return (
    <div className={`lp-flow-shell ${className}`}>
      <div className="lp-flow-header">
        <p className="lp-brand-overline">Activation path</p>
        <h3 className="text-2xl font-semibold text-joa-dark">The clearest product story is a visual one</h3>
      </div>

      <div className="lp-flow-rail">
        {journeySteps.map((step, index) => (
          <div key={step.title} className="lp-flow-card">
            <div className="lp-flow-icon">
              <step.icon className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h4 className="text-lg font-semibold text-joa-dark">{step.title}</h4>
                <span className="lp-flow-stat">{step.stat}</span>
              </div>
              <p className="text-sm leading-7 text-joa-text">{step.copy}</p>
            </div>
            {index < journeySteps.length - 1 ? <div className="lp-flow-connector" /> : null}
          </div>
        ))}
      </div>
    </div>
  );
};

export const WorkspaceMosaicIllustration: React.FC<IllustrationProps> = ({ className = '' }) => {
  return (
    <div className={`lp-mosaic-shell ${className}`}>
      <div className="lp-mosaic-lead">
        <img src="/JoaLLM-logo-large.png" alt="JoaLLM brand poster" className="lp-mosaic-poster" />
        <div className="lp-mosaic-overlay">
          <p className="lp-brand-overline">Positioning</p>
          <h3 className="text-2xl font-semibold text-white">One product language for evaluators, operators, and enterprise owners.</h3>
        </div>
      </div>

      <div className="lp-mosaic-grid">
        {[
          ['Operations teams', 'Repeatable document review and escalation'],
          ['Analysts', 'Source-backed exploration and notebooks'],
          ['Platform owners', 'Security, permissions, and rollout control'],
        ].map(([title, copy], index) => (
          <div key={title} className={`lp-mosaic-card ${index === 1 ? 'lp-mosaic-card-accent' : ''}`}>
            <p className="lp-brand-overline">{title}</p>
            <p className="text-base font-semibold leading-7">{copy}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
