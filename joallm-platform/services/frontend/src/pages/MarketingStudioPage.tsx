import { ArrowRight, ExternalLink, GraduationCap, Radio, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { UseCaseHomeShell } from '../components/use-cases/UseCaseHomeShell';
import { getUseCaseById } from '../constants/useCases';
import { PLATFORM_CONSTITUTION, PLATFORM_NAME } from '../constants/product';
import { ATRISI_PROGRAMS, PRIMARY_GROWTH_PROGRAM } from '../constants/programs';
import { ONTOLOGY } from '../constants/ontology';

export function MarketingStudioPage() {
  const useCase = getUseCaseById('marketing-studio');
  if (!useCase) return null;

  return (
    <UseCaseHomeShell
      brand="institutional"
      useCase={useCase}
      backHref="/studio"
      backLabel="Back to Studio"
      badge={
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-sm font-medium text-teal-800">
          <Radio className="h-4 w-4 text-teal-600" />
          Acquisition Platform · Phase 1
        </div>
      }
      title="Select a Program to acquire interest"
      description="Open an Acquisition Workspace. Organize by Growth Intents; campaigns execute them. Output is Program Interest for Education — not enrollment."
      primaryAction={
        <>
          <Link
            to={`/studio/marketing/${PRIMARY_GROWTH_PROGRAM.id}`}
            className="btn-atrisi-primary inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm"
          >
            Open {PRIMARY_GROWTH_PROGRAM.name}
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/studio/acquisition"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-teal-300 hover:bg-teal-50/40"
          >
            Live WhatsApp acquisition
          </Link>
        </>
      }
      secondaryPanelTitle="Handoff: Program Interest only"
      secondaryPanelBody="Education does not pull posters, ads, or publishing jobs — only Person · Program · Source · Evidence · Intent."
      secondaryPanelContent={
        <div className="space-y-2 text-sm text-slate-200">
          {['Acquire (this platform)', 'Convert (Education)', 'Deliver (Education)'].map((phase, i) => (
            <div
              key={phase}
              className={`rounded-lg border px-3 py-2 font-medium ${
                i === 0
                  ? 'border-teal-400/40 bg-teal-500/15 text-teal-100'
                  : 'border-white/10 bg-white/5 text-slate-300'
              }`}
            >
              {phase}
            </div>
          ))}
        </div>
      }
    >
      <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">ATRISI Programs</h2>
            <p className="mt-1 text-sm text-slate-600">
              Targeting catalog from{' '}
              <a
                href="https://atrisi.org/programs"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-teal-800 underline-offset-2 hover:underline"
              >
                atrisi.org/programs
              </a>
              . Click a Program to open its Acquisition Workspace.
            </p>
          </div>
          <div className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-teal-800">
            {ATRISI_PROGRAMS.length} programs
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {ATRISI_PROGRAMS.map((program) => {
            const isPrimary = program.id === PRIMARY_GROWTH_PROGRAM.id;
            return (
              <Link
                key={program.id}
                to={`/studio/marketing/${program.id}`}
                className={`rounded-2xl border p-5 text-left transition hover:-translate-y-0.5 hover:shadow-md ${
                  isPrimary
                    ? 'border-teal-300 bg-teal-50/60 ring-1 ring-teal-200'
                    : 'border-slate-200 bg-slate-50 hover:border-teal-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {program.familyLabel}
                  </div>
                  {isPrimary && (
                    <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-teal-800">
                      Dogfood
                    </span>
                  )}
                </div>
                <h3 className="mt-2 text-base font-semibold text-slate-950">{program.name}</h3>
                <p className="mt-1 text-sm text-teal-800">{program.tagline}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{program.summary}</p>
                {program.tracks && (
                  <p className="mt-3 text-xs text-slate-500">{program.tracks.join(' · ')}</p>
                )}
                <div className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-teal-800">
                  Open Acquisition Workspace
                  <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 text-teal-700">
            <GraduationCap className="h-5 w-5" />
            <h2 className="text-lg font-semibold text-slate-950">Roadmap</h2>
          </div>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-slate-600">
            <li className="font-medium text-teal-800">Sprint 1 — Program → Acquisition Workspace ✓</li>
            <li className="font-medium text-teal-800">Sprint 2 — Campaign CRUD ✓</li>
            <li className="font-medium text-teal-800">Sprint 2b — Intent catalog (Amplify dogfood) ✓</li>
            <li className="font-medium text-teal-800">Sprint 3 — Creative Projects + Assets ✓</li>
            <li>Sprint 4 — Publishing Jobs</li>
            <li>Sprint 5 — One outbound connector</li>
            <li>Sprint 6 — Timeline → Program Interest</li>
            <li>Sprint 7 — Program Interest API</li>
          </ol>
          <p className="mt-4 text-xs text-slate-500">{PLATFORM_CONSTITUTION}</p>
        </section>
        <section className="rounded-3xl border border-dashed border-teal-200 bg-teal-50/40 p-6">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-teal-700" />
            <h2 className="text-lg font-semibold text-slate-950">Live today: inbound WhatsApp</h2>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            Acquisition Intelligence already ingests WhatsApp into Person Timelines. Next sprints attach
            that engagement to Program Campaigns and Program Interest.
          </p>
          <Link
            to="/studio/acquisition"
            className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-teal-800 hover:text-teal-950"
          >
            Open Acquisition Intelligence
            <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="mt-4 text-xs text-slate-500">
            {ONTOLOGY.product.tagline} · {PLATFORM_NAME}
          </p>
          <a
            href="https://atrisi.org/programs"
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-teal-800"
          >
            atrisi.org/programs
            <ExternalLink className="h-3 w-3" />
          </a>
        </section>
      </div>
    </UseCaseHomeShell>
  );
}
