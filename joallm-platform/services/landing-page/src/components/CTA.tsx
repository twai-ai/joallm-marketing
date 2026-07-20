import React, { useState } from 'react';
import { SurveyModal } from './SurveyModal';
import { Logo } from './ui/Logo';

const highlights = [
  {
    icon: '🏢',
    title: 'Enterprise Evaluation',
    desc: 'Talk through deployment, governance, integrations, and rollout with a guided conversation.',
  },
  {
    icon: '🧪',
    title: 'Self-Serve Trial',
    desc: 'Jump into the live platform if you already know what you want to test.',
  },
  {
    icon: '🎬',
    title: 'Guided Demo',
    desc: 'Use the preview flow if you need a clearer mental model before entering the app.',
  },
];

const poweredBy = ['OpenAI', 'Anthropic', 'Groq', 'PostgreSQL', 'pgvector', 'Redis'];

export const CTA: React.FC = () => {
  const [isSurveyOpen, setIsSurveyOpen] = useState(false);

  return (
    <>
      <section
        id="contact"
        className="relative py-24 overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #4f0a0a 0%, #8B0000 28%, #1d4ed8 62%, #08111f 100%)' }}
      >
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
        <div
          className="lp-orb absolute pointer-events-none"
          style={{
            width: 540,
            height: 540,
            top: '-20%',
            right: '-10%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.10) 0%, transparent 65%)',
          }}
        />

        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lp-cta-shell mb-12">
            <div>
              <div className="flex items-center gap-4 mb-8">
                <Logo size="lg" variant="standalone" />
                <span
                  className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium"
                  style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', color: '#fff' }}
                >
                  Ready to evaluate JoaLLM
                </span>
              </div>

              <h2 className="lp-display font-bold text-white leading-[1.02] tracking-tight mb-6" style={{ fontSize: 'clamp(2.8rem, 6vw, 4.6rem)' }}>
                Choose the next move
                <span className="block text-[#fde68a] mt-1">that fits your buying style.</span>
              </h2>

              <p className="text-lg md:text-xl max-w-3xl leading-relaxed text-blue-100">
                Start with a self-serve trial, walk through the guided demo, or talk with us about deployment,
                governance, and rollout. Each path leads to the same platform.
              </p>
            </div>

            <div className="lp-cta-brand-card">
              <img src="/JoaLLM-logo-standard.png" alt="JoaLLM brand card" className="lp-cta-brand-image" />
              <div className="lp-cta-brand-copy">
                <p className="text-xs uppercase tracking-[0.24em] text-blue-200">Brand signal</p>
                <p className="text-base leading-7 text-white">A clearer product identity helps buyers connect the brand promise to the quality of the workspace itself.</p>
              </div>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-3 mb-12">
            <button
              onClick={() => window.open('https://platform.joallm.ai/', '_blank')}
              className="lp-cta-lane text-left"
            >
              <div className="text-2xl mb-3">🧪</div>
              <h3 className="text-xl font-semibold text-white">Try the platform</h3>
              <p className="mt-3 text-sm leading-7 text-blue-100">
                Best for technical evaluators and self-serve teams who want to test the real workspace.
              </p>
              <span className="mt-5 inline-flex text-sm font-semibold text-yellow-300">Open live product →</span>
            </button>

            <button
              onClick={() => document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' })}
              className="lp-cta-lane text-left"
            >
              <div className="text-2xl mb-3">🎬</div>
              <h3 className="text-xl font-semibold text-white">Review the guided demo</h3>
              <p className="mt-3 text-sm leading-7 text-blue-100">
                Best for buyers who want narrative, trust, and product clarity before entering the app.
              </p>
              <span className="mt-5 inline-flex text-sm font-semibold text-yellow-300">Jump to demo →</span>
            </button>

            <button
              onClick={() => window.open('mailto:support@joallm.ai?subject=Enterprise Evaluation', '_blank')}
              className="lp-cta-lane text-left"
            >
              <div className="text-2xl mb-3">🏢</div>
              <h3 className="text-xl font-semibold text-white">Talk to the team</h3>
              <p className="mt-3 text-sm leading-7 text-blue-100">
                Best for enterprise evaluation, pricing questions, integration planning, and rollout conversations.
              </p>
              <span className="mt-5 inline-flex text-sm font-semibold text-yellow-300">Start enterprise conversation →</span>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
            <button
              onClick={() => window.open('https://platform.joallm.ai/', '_blank')}
              className="bg-white hover:bg-gray-50 text-joa-primary font-bold py-4 px-8 rounded-xl text-base transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl"
            >
              Explore Platform
            </button>
            <button
              onClick={() => window.open('mailto:support@joallm.ai?subject=Schedule Demo', '_blank')}
              className="font-bold py-4 px-8 rounded-xl text-base transition-all duration-200 transform hover:scale-105 text-white"
              style={{ border: '2px solid rgba(255,255,255,0.4)' }}
              onMouseEnter={(event) => (event.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
              onMouseLeave={(event) => (event.currentTarget.style.background = 'transparent')}
            >
              Schedule Demo
            </button>
            <button
              onClick={() => setIsSurveyOpen(true)}
              className="bg-yellow-400 hover:bg-yellow-300 text-joa-dark font-bold py-4 px-8 rounded-xl text-base transition-all duration-200 transform hover:scale-105 shadow-lg"
            >
              Share your use case
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-16">
            {highlights.map((highlight) => (
              <div
                key={highlight.title}
                className="rounded-2xl p-5 text-center"
                style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' }}
              >
                <div className="text-2xl mb-2">{highlight.icon}</div>
                <h3 className="font-semibold text-white text-sm mb-1.5">{highlight.title}</h3>
                <p className="text-sm text-blue-100 leading-relaxed">{highlight.desc}</p>
              </div>
            ))}
          </div>

          <div className="pt-10" style={{ borderTop: '1px solid rgba(255,255,255,0.15)' }}>
            <p className="text-xs uppercase tracking-widest mb-5 text-blue-200 text-center">Powered by</p>
            <div className="flex flex-wrap justify-center items-center gap-6">
              {poweredBy.map((name) => (
                <span key={name} className="text-sm font-semibold text-blue-200 opacity-70">
                  {name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <SurveyModal isOpen={isSurveyOpen} onClose={() => setIsSurveyOpen(false)} />
    </>
  );
};
