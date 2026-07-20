import { ArrowRight, LayoutDashboard, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { USE_CASES } from '../constants/useCases';
import { PLATFORM_CONSTITUTION, PLATFORM_TAGLINE } from '../constants/product';

export function StudioOverviewPage() {
  return (
    <div className="atrisi-page min-h-screen bg-slate-50">
      <div className="workspace-shell flex flex-col gap-6 px-0 py-6">
        <section className="overflow-hidden rounded-3xl border border-atrisi-gray-dark bg-white shadow-sm">
          <div className="atrisi-accent-line w-full" aria-hidden />
          <div className="grid gap-8 p-6 lg:grid-cols-[1.25fr_0.85fr] lg:p-8">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-sm font-medium text-teal-800">
                <LayoutDashboard className="h-4 w-4 text-teal-600" />
                Studio · Create
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                Guided Studio workspaces for marketing work
              </h1>
              <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
                {PLATFORM_CONSTITUTION} Each workspace aligns UX to the asset and outcome — Media,
                Documents, Acquisition Channels, Marketing Assets — instead of a generic builder.
              </p>
              <p className="mt-3 text-sm text-slate-500">{PLATFORM_TAGLINE}</p>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-950 p-6 text-white shadow-[0_0_40px_rgba(20,184,166,0.12)]">
              <div className="text-sm font-medium text-teal-300">Live today</div>
              <h2 className="mt-3 text-2xl font-semibold">Studio → Brain</h2>
              <div className="mt-6 space-y-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-white">
                    <Sparkles className="h-4 w-4 text-cyan-300" />
                    Media AI
                  </div>
                  <p className="mt-2 text-sm text-slate-300">
                    Interpret recordings into Knowledge Artifacts the Brain can retrieve.
                  </p>
                </div>
                <div className="rounded-2xl border border-teal-500/20 bg-teal-500/5 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-white">
                    <Sparkles className="h-4 w-4 text-teal-300" />
                    Acquisition Intelligence
                  </div>
                  <p className="mt-2 text-sm text-slate-300">
                    Channels + Connectors feed a unified Person Timeline.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-white">
                    <Sparkles className="h-4 w-4 text-sky-300" />
                    Document AI
                  </div>
                  <p className="mt-2 text-sm text-slate-300">
                    Ingest documents into Knowledge for grounded Chat and retrieval.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-slate-950">Studio directory</h2>
              <p className="mt-1 text-sm text-slate-600">
                Open live workspaces now. Placeholders stay visible without looking interactive.
              </p>
            </div>
            <div className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-teal-800">
              {USE_CASES.length} workspaces
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {USE_CASES.map((workspace) => (
              <div
                key={workspace.id}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-5 transition hover:border-teal-300/80"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-950">{workspace.label}</h3>
                    <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">
                      {workspace.status === 'active' ? 'Live' : 'Soon'}
                    </p>
                  </div>
                  <div className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600">
                    {workspace.shortLabel}
                  </div>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">{workspace.description}</p>
                {workspace.status === 'active' || workspace.id === 'marketing-studio' ? (
                  <Link
                    to={workspace.homeRoute}
                    className="btn-atrisi-primary mt-4 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm"
                  >
                    {workspace.id === 'marketing-studio' ? 'Open Creative AI preview' : 'Open workspace'}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-400">
                    Coming soon
                    <ArrowRight className="h-4 w-4" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
