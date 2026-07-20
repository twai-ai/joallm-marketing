import React from 'react';
import { ArrowRight, BarChart3, Clapperboard, FileText, Layers3 } from 'lucide-react';
import { WorkspaceMosaicIllustration } from './PlatformIllustrations';

const useCases = [
  {
    title: 'Media AI',
    icon: Clapperboard,
    eyebrow: 'Active Workspace',
    description:
      'This is the first live guided Studio workspace in the codebase: upload audio or video, track processing, and open structured analysis without forcing users into the workflow canvas first.',
    points: [
      'Transcript-driven pipeline for recordings and media files',
      'Guided upload, progress tracking, and analysis review',
      'Reference pattern for how future Studio workspaces should feel',
    ],
    cta: 'See guided demo',
    action: () => document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' }),
    status: 'Live now',
    audience: 'Creators, operators, and teams analyzing recordings',
  },
  {
    title: 'Document AI',
    icon: FileText,
    eyebrow: 'Active Workspace',
    description:
      'Document AI is the guided front door for document-heavy teams: ingest files, watch readiness states, then move into grounded retrieval and follow-up work with the right sources already in focus.',
    points: [
      'Document ingestion plus readiness tracking before retrieval',
      'Grounded Q&A and source-aware follow-up workflows',
      'A cleaner bridge between knowledge management and chat',
    ],
    cta: 'Explore knowledge flow',
    action: () => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' }),
    status: 'Active next',
    audience: 'Knowledge managers and document-heavy teams',
  },
  {
    title: 'Data Intelligence',
    icon: BarChart3,
    eyebrow: 'Reserved Lane',
    description:
      'This lane is intentionally held as a placeholder in the codebase for structured datasets, operational metrics, and intelligence pipelines once the shared Studio patterns mature further.',
    points: [
      'Future workspace for tabular, event, and metrics-driven analysis',
      'Built on the same Studio shell instead of becoming a disconnected side tool',
      'Keeps the roadmap visible without overpromising unfinished surfaces',
    ],
    cta: 'Review roadmap fit',
    action: () => document.getElementById('security')?.scrollIntoView({ behavior: 'smooth' }),
    status: 'Planned',
    audience: 'Operators, analysts, and teams working with structured data',
  },
];

export const UseCases: React.FC = () => {
  return (
    <section id="use-cases" className="lp-section py-24 relative overflow-hidden" style={{ scrollMarginTop: '72px' }}>
      <div className="absolute inset-0 lp-dot-grid" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 xl:grid-cols-[1.04fr_0.96fr] items-center mb-16">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest mb-4 text-joa-primary">Use Cases</p>
            <h2 className="lp-display font-bold text-joa-dark leading-tight mb-5" style={{ fontSize: 'clamp(2.3rem, 4.5vw, 3.8rem)' }}>
              Studio is growing through
              <span className="lp-gradient-text"> guided workflow families</span>
            </h2>
            <p className="text-lg text-joa-text max-w-2xl leading-8">
              The codebase is converging on a product model where each use case gets a guided home in Studio, while
              still sharing one backend, one navigation system, and one operational language.
            </p>
          </div>

          <div className="lp-editorial-panel lp-editorial-panel-light">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-joa-primary mb-4">Product architecture signal</p>
            <p className="text-lg text-joa-text leading-8">
              These are not separate products. They are guided surfaces on top of one shared Studio foundation, with
              different maturity levels depending on what the platform can already support well.
            </p>
          </div>
        </div>

        <div className="grid gap-8 items-center lg:grid-cols-[0.96fr_1.04fr] mb-12">
          <div>
            <WorkspaceMosaicIllustration />
          </div>

          <div className="grid gap-5">
            {['Guided first, canvas second', 'Active plus placeholder lanes', 'Role-aware workspace framing'].map((item) => (
              <div key={item} className="lp-usecase-note">
                <span className="lp-usecase-note-dot" />
                <p className="text-base font-medium text-joa-dark">{item}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {useCases.map((useCase) => (
            <div key={useCase.title} className="lp-usecase-card p-7 flex flex-col gap-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-joa-primary">{useCase.eyebrow}</p>
                  <h3 className="mt-3 text-xl font-semibold text-joa-dark">{useCase.title}</h3>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{useCase.status}</p>
                </div>
                <div className="lp-icon-box" style={{ background: 'rgba(139, 0, 0, 0.08)' }}>
                  <useCase.icon className="h-5 w-5 text-joa-primary" />
                </div>
              </div>

              <p className="text-sm leading-7 text-joa-text">{useCase.description}</p>

              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  <Layers3 className="h-3.5 w-3.5" />
                  Best fit
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{useCase.audience}</p>
              </div>

              <ul className="space-y-3">
                {useCase.points.map((point) => (
                  <li key={point} className="flex items-start gap-3 text-sm text-joa-text">
                    <span className="mt-1 h-2 w-2 rounded-full bg-joa-primary" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>

              <button onClick={useCase.action} className="lp-inline-link mt-auto">
                {useCase.cta}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
