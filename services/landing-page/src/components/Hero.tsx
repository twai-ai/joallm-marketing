import React from 'react';
import { ArrowRight, BookOpenText, Building2, ShieldCheck, Sparkles, Workflow } from 'lucide-react';
import { Logo } from './ui/Logo';
import { HeroPlatformIllustration } from './PlatformIllustrations';

const stats = [
  { value: '20+', label: 'Models across major providers' },
  { value: '35+', label: 'Document formats supported' },
  { value: '1', label: 'Connected AI workspace' },
  { value: 'Live', label: 'Platform available today' },
];

const trustSignals = [
  {
    title: 'Grounded by knowledge',
    description: 'Upload, index, query, and inspect source-backed answers in one flow.',
    icon: BookOpenText,
  },
  {
    title: 'Ready for teams',
    description: 'Workflows, notebooks, usage visibility, and a cleaner path to governed AI work.',
    icon: Building2,
  },
  {
    title: 'Built for enterprise trust',
    description: 'Permissions, plan awareness, and operational clarity are part of the product story.',
    icon: ShieldCheck,
  },
];

const heroHighlights = [
  { label: 'Grounded retrieval', icon: BookOpenText },
  { label: 'Workflow automation', icon: Workflow },
  { label: 'Enterprise trust', icon: ShieldCheck },
];

export const Hero: React.FC = () => {
  return (
    <section className="lp-hero-shell relative min-h-screen overflow-hidden bg-joa-network">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="lp-orb absolute"
          style={{
            width: 620,
            height: 620,
            top: '-10%',
            left: '2%',
            background: 'radial-gradient(circle, rgba(139,0,0,0.14) 0%, transparent 65%)',
            animationDelay: '0s',
          }}
        />
        <div
          className="lp-orb absolute"
          style={{
            width: 520,
            height: 520,
            bottom: '-6%',
            right: '0%',
            background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 65%)',
            animationDelay: '5s',
          }}
        />
      </div>

      <div className="absolute inset-0 lp-line-grid opacity-60" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-20">
        <div className="grid gap-14 xl:grid-cols-[0.96fr_1.04fr] xl:items-center">
          <div>
            <div className="flex items-center mb-8">
              <span className="lp-badge lp-badge-soft">
                <Sparkles className="h-3.5 w-3.5" />
                Enterprise AI workspace · Live platform
              </span>
            </div>

            <div className="mb-8">
              <Logo size="xl" variant="header" />
            </div>

            <h1 className="lp-display font-bold text-joa-dark leading-[0.97] tracking-tight mb-6" style={{ fontSize: 'clamp(3.1rem, 7vw, 6.2rem)' }}>
              One AI workspace
              <span className="lp-gradient-text block mt-2">for grounded work, fast answers, and repeatable execution.</span>
            </h1>

            <p className="text-lg md:text-[1.18rem] text-joa-text leading-8 mb-8 max-w-2xl">
              ATRISI Marketing brings acquisition intelligence, grounded retrieval, notebooks, workflows, and
              institutional memory into one connected product so teams can move from first contact to verified outcomes.
            </p>

            <div className="flex flex-wrap gap-3 mb-10">
              {heroHighlights.map((item) => (
                <span key={item.label} className="lp-hero-chip">
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </span>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center mb-10">
              <button className="lp-btn-primary" onClick={() => window.open('https://platform.joallm.ai/', '_blank')}>
                Try Platform
                <ArrowRight className="h-4 w-4" />
              </button>
              <button className="lp-btn-secondary" onClick={() => document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' })}>
                See Guided Demo
              </button>
              <button
                className="lp-inline-link"
                onClick={() => window.open('mailto:support@joallm.ai?subject=Enterprise Inquiry', '_blank')}
              >
                Talk to sales
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {trustSignals.map((signal) => (
                <div key={signal.title} className="lp-signal-card lp-signal-card-premium">
                  <div className="lp-icon-box mb-4" style={{ background: 'rgba(139, 0, 0, 0.08)' }}>
                    <signal.icon className="h-5 w-5 text-joa-primary" />
                  </div>
                  <h3 className="text-sm font-semibold text-joa-dark">{signal.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-joa-text">{signal.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="lp-stage-card lp-stage-card-premium">
            <div className="lp-stage-topline">
              <span>Guided Product Preview</span>
              <span className="lp-stage-pill">Upload → Ask → Verify → Operationalize</span>
            </div>

            <HeroPlatformIllustration />
          </div>
        </div>

        <div className="lp-stat-grid max-w-5xl mt-14">
          {stats.map((s) => (
            <div key={s.label} className="lp-stat-item">
              <div className="text-2xl md:text-3xl font-bold text-joa-primary mb-1">{s.value}</div>
              <div className="text-xs md:text-sm text-joa-text">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
