import React, { useState } from 'react';

const platformUrl = import.meta.env.VITE_PLATFORM_URL || 'https://platform.atrisi.org/';
const razorpayPaymentLink = import.meta.env.VITE_RAZORPAY_PAYMENT_LINK_URL;

const tiers = [
  {
    name: 'Free',
    price: { monthly: 0, annual: 0 },
    description: 'Everything you need to explore JoaLLM.',
    cta: 'Get started free',
    ctaAction: () => window.open(platformUrl, '_blank'),
    highlight: false,
    limits: [
      '10 documents',
      '100 MB storage',
      '20 chat sessions',
      '3 workflows',
      '3 notebooks',
      '50 API requests / day',
    ],
    features: [
      'pgvector RAG search',
      'All 4 LLM providers',
      'Conditional workflows',
      'AI notebooks (JS sandbox)',
      'Google OAuth',
      '2FA + account lockout',
    ],
    missing: ['Custom API keys', 'Cloud storage (R2/S3)', 'Data export', 'Priority support'],
  },
  {
    name: 'Pro',
    price: { monthly: 5, annual: 290 },
    regularPrice: 29,
    description: 'For teams building production AI products.',
    cta: "Claim founder's offer",
    ctaAction: () =>
      window.open(razorpayPaymentLink || platformUrl, '_blank'),
    highlight: true,
    badge: "Founder's Offer",
    limits: [
      '200 documents',
      '5 GB storage',
      '500 chat sessions',
      '50 workflows',
      '50 notebooks',
      '2,000 API requests / day',
    ],
    features: [
      'Everything in Free',
      'Custom API keys (OpenAI, Anthropic, Groq, Cohere)',
      'Cloud storage (Cloudflare R2 / AWS S3)',
      'Data export',
      'Hybrid FTS + semantic search',
      'Workflow execution history',
      'Notebook auto-save + sharing',
      'Email support',
    ],
    missing: [],
  },
  {
    name: 'Enterprise',
    price: { monthly: null, annual: null },
    description: 'Unlimited scale, dedicated support, custom integrations.',
    cta: 'Contact sales',
    ctaAction: () =>
      window.open(
        'mailto:support@joallm.ai?subject=Enterprise Plan Inquiry&body=Hi, I would like to discuss an Enterprise plan.',
        '_blank',
      ),
    highlight: false,
    limits: [
      'Unlimited documents',
      'Unlimited storage',
      'Unlimited chat sessions',
      'Unlimited workflows',
      'Unlimited notebooks',
      'Unlimited API requests',
    ],
    features: [
      'Everything in Pro',
      'Dedicated engineering support',
      'Custom integrations & workflows',
      'SLA guarantees',
      'Audit log export',
      'SSO / SAML',
      'On-premise deployment option',
      'Custom model endpoints',
    ],
    missing: [],
  },
];

const check = (
  <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 16 16" fill="none">
    <path d="M3 8.5L6 11.5L13 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const cross = (
  <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 16 16" fill="none">
    <path d="M5 5L11 11M11 5L5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export const Pricing: React.FC = () => {
  const [annual, setAnnual] = useState(false);

  return (
    <section
      id="pricing"
      className="lp-section py-24 relative overflow-hidden"
      style={{ scrollMarginTop: '72px' }}
    >
      <div className="absolute inset-0 lp-dot-grid" />
      <div
        className="lp-orb absolute pointer-events-none"
        style={{
          width: 500,
          height: 500,
          top: '0%',
          right: '-5%',
          background: 'radial-gradient(circle, rgba(59,130,246,0.07) 0%, transparent 65%)',
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <p className="text-sm font-semibold uppercase tracking-widest mb-4 text-joa-primary">
            Pricing
          </p>
          <h2
            className="font-bold text-joa-dark leading-tight mb-4"
            style={{ fontSize: 'clamp(2rem, 4.5vw, 3rem)' }}
          >
            Simple, transparent
            <span className="lp-gradient-text"> pricing</span>
          </h2>
          <p className="text-lg text-joa-text mb-8">
            Start free. Upgrade when you need more.
          </p>

          {/* Billing toggle */}
          <div className="inline-flex items-center gap-3 bg-white rounded-xl px-4 py-2.5 border border-gray-200 shadow-sm">
            <button
              onClick={() => setAnnual(false)}
              className={`text-sm font-medium px-3 py-1 rounded-lg transition-all ${
                !annual ? 'bg-joa-primary text-white shadow-sm' : 'text-joa-text hover:text-joa-dark'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`text-sm font-medium px-3 py-1 rounded-lg transition-all flex items-center gap-2 ${
                annual ? 'bg-joa-primary text-white shadow-sm' : 'text-joa-text hover:text-joa-dark'
              }`}
            >
              Annual
              <span
                className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                  annual ? 'bg-white/20 text-white' : 'bg-green-100 text-green-700'
                }`}
              >
                Save 17%
              </span>
            </button>
          </div>
        </div>

        {/* Tier cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {tiers.map(tier => (
            <div
              key={tier.name}
              className={`lp-glass-card flex flex-col relative overflow-hidden ${
                tier.highlight ? 'ring-2 ring-joa-primary shadow-xl' : ''
              }`}
            >
              {/* Badge */}
              {tier.badge && (
                <div
                  className="absolute top-0 right-0 text-xs font-bold px-3 py-1 rounded-bl-xl"
                  style={
                    tier.badge === "Founder's Offer"
                      ? { background: '#D97706', color: '#fff' }
                      : { background: 'var(--joa-primary)', color: '#fff' }
                  }
                >
                  {tier.badge}
                </div>
              )}

              <div className="p-7 border-b border-gray-100">
                <h3 className="text-lg font-bold text-joa-dark mb-1">{tier.name}</h3>
                <p className="text-sm text-joa-text mb-5">{tier.description}</p>

                {/* Price */}
                <div className="mb-5">
                  {tier.price.monthly === null ? (
                    <div className="text-3xl font-bold text-joa-dark">Custom</div>
                  ) : tier.price.monthly === 0 ? (
                    <div className="text-3xl font-bold text-joa-dark">
                      $0<span className="text-base font-normal text-joa-text">/mo</span>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-joa-dark">
                          ${annual ? Math.round(tier.price.annual! / 12) : tier.price.monthly}
                          <span className="text-base font-normal text-joa-text">/mo</span>
                        </span>
                        {(tier as any).regularPrice && !annual && (
                          <span className="text-base font-medium text-joa-text line-through opacity-60">
                            ${(tier as any).regularPrice}
                          </span>
                        )}
                      </div>
                      {(tier as any).regularPrice && !annual && (
                        <div className="text-xs text-amber-600 font-medium mt-1">
                          First 3 months · then ${(tier as any).regularPrice}/mo
                        </div>
                      )}
                      {annual && (
                        <div className="text-xs text-joa-text mt-0.5">
                          Billed ${tier.price.annual}/year
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <button
                  onClick={tier.ctaAction}
                  className={`w-full py-2.5 px-4 rounded-xl text-sm font-semibold transition-all ${
                    tier.highlight
                      ? 'lp-btn-primary justify-center'
                      : 'lp-btn-secondary justify-center'
                  }`}
                >
                  {tier.cta}
                </button>
              </div>

              <div className="p-7 flex flex-col gap-6 flex-1">
                {/* Limits */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-joa-text mb-3">
                    Limits
                  </p>
                  <ul className="flex flex-col gap-2">
                    {tier.limits.map(l => (
                      <li key={l} className="flex items-center gap-2 text-sm text-joa-text">
                        <span className="text-joa-primary">{check}</span>
                        {l}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Features */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-joa-text mb-3">
                    Features
                  </p>
                  <ul className="flex flex-col gap-2">
                    {tier.features.map(f => (
                      <li key={f} className="flex items-center gap-2 text-sm text-joa-text">
                        <span className="text-green-600">{check}</span>
                        {f}
                      </li>
                    ))}
                    {tier.missing.map(f => (
                      <li key={f} className="flex items-center gap-2 text-sm text-gray-300">
                        <span className="text-gray-300">{cross}</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer note */}
        <p className="text-center text-sm text-joa-text mt-10">
          All plans include 2FA, account lockout, RBAC, and audit logging.
          No credit card required for Free.{' '}
          <button
            className="text-joa-primary underline underline-offset-2 hover:no-underline"
            onClick={() =>
              window.open('mailto:support@joallm.ai?subject=Pricing Question', '_blank')
            }
          >
            Questions? Talk to us.
          </button>
        </p>
      </div>
    </section>
  );
};
