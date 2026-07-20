import { ArrowRight, Palette, Radio, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { UseCaseHomeShell } from '../components/use-cases/UseCaseHomeShell';
import { getUseCaseById } from '../constants/useCases';
import { PLATFORM_CONSTITUTION } from '../constants/product';

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
          Marketing Studio · Preview
        </div>
      }
      title="Create Marketing Assets — Creative AI lives here"
      description="Studio owns creative and publish intent. Platform Creative AI owns providers. Configure BYOK keys now; Generation Profiles and asset canvas ship next."
      primaryAction={
        <>
          <button
            type="button"
            onClick={openCreativeSettings}
            className="btn-atrisi-primary inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm"
          >
            <Palette className="h-4 w-4" />
            Open Creative AI keys
          </button>
          <Link
            to="/studio/acquisition"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-teal-300 hover:bg-teal-50/40"
          >
            Acquisition Intelligence
            <ArrowRight className="h-4 w-4" />
          </Link>
        </>
      }
      secondaryPanelTitle="Where is Creative AI?"
      secondaryPanelBody="Not a separate Studio tile. Configure providers under Settings → AI & Models → Creative AI providers. Marketing Studio will call them through Generation Profiles (Style + Quality + Auto)."
      secondaryPanelContent={
        <div className="space-y-3 text-sm text-slate-200">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="font-medium text-teal-200">1. Platform</div>
            <p className="mt-1 text-slate-300">Add Imagen / FLUX / Ideogram / Stability / Firefly keys (OpenAI covers GPT Image).</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="font-medium text-teal-200">2. Studio</div>
            <p className="mt-1 text-slate-300">Generation Profiles pick Style + Quality; Auto routes the provider.</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="font-medium text-teal-200">3. Publish</div>
            <p className="mt-1 text-slate-300">Marketing Assets go out via Channels → Platform Connectors.</p>
          </div>
        </div>
      }
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 text-teal-700">
            <Sparkles className="h-5 w-5" />
            <h2 className="text-lg font-semibold text-slate-950">Coming in this workspace</h2>
          </div>
          <ul className="mt-4 space-y-2 text-sm text-slate-600">
            <li>• Generation Profiles (style kits + Auto provider)</li>
            <li>• Marketing Asset canvas (copy, creatives, campaigns)</li>
            <li>• Publish jobs through Channels (LinkedIn, Meta, Email, …)</li>
          </ul>
          <p className="mt-4 text-xs text-slate-500">{PLATFORM_CONSTITUTION}</p>
        </section>
        <section className="rounded-3xl border border-dashed border-teal-200 bg-teal-50/40 p-6">
          <h2 className="text-lg font-semibold text-slate-950">Configure Creative AI now</h2>
          <p className="mt-2 text-sm text-slate-600">
            Keys are encrypted like chat BYOK. Until Marketing Studio generates assets, keys sit ready on the Platform.
          </p>
          <button
            type="button"
            onClick={openCreativeSettings}
            className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-teal-800 hover:text-teal-950"
          >
            Settings → AI & Models → Creative AI providers
            <ArrowRight className="h-4 w-4" />
          </button>
        </section>
      </div>
    </UseCaseHomeShell>
  );
}
