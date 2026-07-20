import React from 'react';
import { ArrowRight, LayoutDashboard, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { USE_CASES } from '../constants/useCases';

export function StudioOverviewPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-amber-50 to-white">
      <div className="workspace-shell flex flex-col gap-6 px-0 py-6">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white/90 shadow-lg shadow-amber-100">
          <div className="grid gap-8 p-6 lg:grid-cols-[1.25fr_0.85fr] lg:p-8">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
                <LayoutDashboard className="h-4 w-4" />
                Studio
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                Guided AI workspaces for each kind of problem
              </h1>
              <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
                Use Studio as the front door to focused AI workflows. Each workspace keeps the UX aligned to the asset type and outcome instead of dropping you straight into a generic builder.
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 text-white">
              <div className="text-sm font-medium text-amber-200">Studio overview</div>
              <h2 className="mt-3 text-2xl font-semibold">Live today</h2>
              <div className="mt-6 space-y-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-white">
                    <Sparkles className="h-4 w-4 text-emerald-300" />
                    Media AI
                  </div>
                  <p className="mt-2 text-sm text-slate-300">
                    Upload recordings, follow AI processing, and review structured media intelligence.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-white">
                    <Sparkles className="h-4 w-4 text-sky-300" />
                    Document AI
                  </div>
                  <p className="mt-2 text-sm text-slate-300">
                    Ingest documents, track readiness, and move into grounded retrieval with the right sources.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">Workspace Directory</h2>
              <p className="mt-1 text-sm text-slate-600">
                Open the live workspaces now, and keep placeholders visible without making them look interactive.
              </p>
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
              {USE_CASES.length} workspaces
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {USE_CASES.map((workspace) => (
              <div key={workspace.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">{workspace.label}</h3>
                    <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">{workspace.status}</p>
                  </div>
                  <div className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-600 shadow-sm">
                    {workspace.shortLabel}
                  </div>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">{workspace.description}</p>
                {workspace.status === 'active' ? (
                  <Link
                    to={workspace.homeRoute}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    Open Workspace
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-400">
                    Preview Workspace
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
