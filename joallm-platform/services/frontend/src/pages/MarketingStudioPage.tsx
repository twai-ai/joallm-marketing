import { ArrowRight, GraduationCap, Palette, Radio, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { UseCaseHomeShell } from '../components/use-cases/UseCaseHomeShell';
import { getUseCaseById } from '../constants/useCases';
import { PLATFORM_CONSTITUTION, PLATFORM_NAME, PLATFORM_CAPABILITY } from '../constants/product';
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
          Program Growth · Preview
        </div>
      }
      title="Start from the Program — not a blank canvas"
      description="Marketing Studio grows Programs (bootcamps, degrees, workshops). Select a Program → Campaign → Creative → Assets → Publish. Creative AI and Channels are contextual to that Program."
      primaryAction={
        <>
          <button
            type="button"
            onClick={openCreativeSettings}
            className="btn-atrisi-primary inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm"
          >
            <Palette className="h-4 w-4" />
            Creative AI keys
          </button>
          <Link
            to="/studio/acquisition"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-teal-300 hover:bg-teal-50/40"
          >
            Acquisition → Person Timelines
            <ArrowRight className="h-4 w-4" />
          </Link>
        </>
      }
      secondaryPanelTitle="Program → Enrollment"
      secondaryPanelBody="Campaigns live under Programs. Engagement feeds Applications → Admissions → Enrollment → Learning (Education Brain)."
      secondaryPanelContent={
        <div className="space-y-2 text-sm text-slate-200">
          {['Program', 'Campaign', 'Creative', 'Assets', 'Channels', 'Applications'].map((step) => (
            <div key={step} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-medium text-teal-100">
              {step}
            </div>
          ))}
        </div>
      }
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 text-teal-700">
            <GraduationCap className="h-5 w-5" />
            <h2 className="text-lg font-semibold text-slate-950">Example workspace</h2>
          </div>
          <p className="mt-2 text-sm font-medium text-slate-800">Program: Amplify with AI</p>
          <p className="mt-1 text-sm text-slate-600">
            Campaigns become Early Bird, Campus Ambassador, Faculty Referral, Women in AI, Hackathon, Final Call —
            each with its own creatives and channels.
          </p>
          <ul className="mt-4 space-y-2 text-sm text-slate-600">
            <li>· Overview · Campaigns · Assets · Creatives</li>
            <li>· Audience · Channels · Applications · Analytics</li>
            <li>· North star: {ONTOLOGY.analyticsNorthStar.join(' · ')}</li>
          </ul>
          <p className="mt-4 text-xs text-slate-500">{PLATFORM_CONSTITUTION}</p>
        </section>
        <section className="rounded-3xl border border-dashed border-teal-200 bg-teal-50/40 p-6">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-teal-700" />
            <h2 className="text-lg font-semibold text-slate-950">Creative AI knows context</h2>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            Instead of “generate a LinkedIn post,” Studio knows Program, Campaign, Audience, Tone, and CTA — then
            produces Poster, Reel, LinkedIn, Instagram, WhatsApp, and Email consistently via Generation Profiles.
          </p>
          <button
            type="button"
            onClick={openCreativeSettings}
            className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-teal-800 hover:text-teal-950"
          >
            Configure Creative AI providers
            <ArrowRight className="h-4 w-4" />
          </button>
          <p className="mt-4 text-xs text-slate-500">
            Capability: {PLATFORM_CAPABILITY} · Brand: {PLATFORM_NAME}
          </p>
        </section>
      </div>
    </UseCaseHomeShell>
  );
}
