import { ArrowRight, ExternalLink, GraduationCap, Palette, Radio, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { UseCaseHomeShell } from '../components/use-cases/UseCaseHomeShell';
import { getUseCaseById } from '../constants/useCases';
import { PLATFORM_CAPABILITY, PLATFORM_CONSTITUTION, PLATFORM_NAME } from '../constants/product';
import { ATRISI_PROGRAMS, PRIMARY_GROWTH_PROGRAM } from '../constants/programs';
import { ONTOLOGY } from '../constants/ontology';

function openCreativeSettings() {
  window.dispatchEvent(new CustomEvent('openSettings', { detail: { tab: 'models' } }));
}

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
          Program Aggregate · Growth preview
        </div>
      }
      title="Programs are the OS — Growth is one capability"
      description="ATRISI starts from Program, not Campaign. Each Program will carry Growth, Admissions, Learning, Assessment, and Analytics. Marketing Studio today is the entry to that Program catalog and the Growth workspace."
      primaryAction={
        <>
          <a
            href="https://atrisi.org/programs"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-teal-300 hover:bg-teal-50/40"
          >
            View catalog
            <ExternalLink className="h-4 w-4" />
          </a>
          <button
            type="button"
            onClick={openCreativeSettings}
            className="btn-atrisi-primary inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm"
          >
            <Palette className="h-4 w-4" />
            Creative AI keys
          </button>
        </>
      }
      secondaryPanelTitle="Core vs Capability"
      secondaryPanelBody="Program Core defines what the Program is. Growth (and Admissions, Learning, …) are attached capabilities — not fields on Core."
      secondaryPanelContent={
        <div className="space-y-3 text-sm">
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            <div className="text-xs uppercase tracking-wide text-teal-200/80">Program.Core</div>
            <div className="mt-1 text-slate-200">{ONTOLOGY.programCore.join(' · ')}</div>
          </div>
          <div className="rounded-lg border border-teal-400/40 bg-teal-500/15 px-3 py-2">
            <div className="text-xs uppercase tracking-wide text-teal-200">Capabilities</div>
            <div className="mt-1 text-teal-50">{ONTOLOGY.programCapabilities.join(' · ')}</div>
          </div>
        </div>
      }
    >
      <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">ATRISI Programs</h2>
            <p className="mt-1 text-sm text-slate-600">
              Seeded from{' '}
              <a
                href="https://atrisi.org/programs"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-teal-800 underline-offset-2 hover:underline"
              >
                atrisi.org/programs
              </a>
              . Select a Program to open its Marketing Workspace (coming next).
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
              <div
                key={program.id}
                className={`rounded-2xl border p-5 ${
                  isPrimary
                    ? 'border-teal-300 bg-teal-50/60 ring-1 ring-teal-200'
                    : 'border-slate-200 bg-slate-50'
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
                <div className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-slate-400">
                  Program Workspace soon
                  <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 text-teal-700">
            <GraduationCap className="h-5 w-5" />
            <h2 className="text-lg font-semibold text-slate-950">Growth workspace (under Program)</h2>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            Workspace tabs: {ONTOLOGY.programWorkspaceTabs.join(' · ')}. Growth owns:{' '}
            {ONTOLOGY.growthAggregate.join(' · ')}.
          </p>
          <ul className="mt-4 space-y-2 text-sm text-slate-600">
            <li>· Pattern: Capability = Strategy · Operations · Timeline · Intelligence · Analytics</li>
            <li>· Dogfood: {PRIMARY_GROWTH_PROGRAM.name}</li>
            <li>· Next: Program + ProgramCore types/schema — then Growth objects</li>
          </ul>
          <p className="mt-4 text-xs text-slate-500">{PLATFORM_CONSTITUTION}</p>
        </section>
        <section className="rounded-3xl border border-dashed border-teal-200 bg-teal-50/40 p-6">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-teal-700" />
            <h2 className="text-lg font-semibold text-slate-950">Creative AI knows the Program</h2>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            Generate Poster · Reel · LinkedIn · Instagram · WhatsApp · Email with Program, Campaign,
            Audience, Tone, and CTA already bound — via Generation Profiles.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={openCreativeSettings}
              className="inline-flex items-center gap-2 text-sm font-semibold text-teal-800 hover:text-teal-950"
            >
              Configure Creative AI
              <ArrowRight className="h-4 w-4" />
            </button>
            <Link
              to="/studio/acquisition"
              className="inline-flex items-center gap-2 text-sm font-semibold text-teal-800 hover:text-teal-950"
            >
              Acquisition Timelines
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Capability: {PLATFORM_CAPABILITY} · Brand: {PLATFORM_NAME}
          </p>
        </section>
      </div>
    </UseCaseHomeShell>
  );
}
