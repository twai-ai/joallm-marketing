import { useMemo, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  Image as ImageIcon,
  LayoutDashboard,
  Megaphone,
  Radio,
  Target,
} from 'lucide-react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { UseCaseHomeShell } from '../components/use-cases/UseCaseHomeShell';
import { getUseCaseById } from '../constants/useCases';
import { getProgramById, PRIMARY_GROWTH_PROGRAM } from '../constants/programs';
import { ONTOLOGY } from '../constants/ontology';

type WorkspaceTab = 'overview' | 'campaigns' | 'channels' | 'assets' | 'analytics';

const TABS: { id: WorkspaceTab; label: string; icon: typeof Megaphone }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'campaigns', label: 'Campaigns', icon: Megaphone },
  { id: 'channels', label: 'Channels', icon: Radio },
  { id: 'assets', label: 'Assets', icon: ImageIcon },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
];

/** Static placeholder campaigns for Sprint 1 — dogfood Amplify intents */
const SAMPLE_CAMPAIGN_INTENTS = [
  'Early Bird',
  'Campus Ambassador',
  'Faculty Referral',
  'Women in AI',
  'Hackathon',
  'Final Call',
];

function PlaceholderPanel({
  title,
  body,
  nextSprint,
}: {
  title: string;
  body: string;
  nextSprint: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6">
      <h3 className="text-lg font-semibold text-slate-950">{title}</h3>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{body}</p>
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.15em] text-teal-800">
        {nextSprint}
      </p>
    </div>
  );
}

export function AcquisitionWorkspacePage() {
  const { programId = '' } = useParams<{ programId: string }>();
  const useCase = getUseCaseById('marketing-studio');
  const program = getProgramById(programId);
  const [tab, setTab] = useState<WorkspaceTab>('overview');

  const brand = program?.id === 'amplify-with-ai' ? 'amplify' : 'institutional';

  const sampleCampaigns = useMemo(
    () =>
      SAMPLE_CAMPAIGN_INTENTS.map((name, index) => ({
        id: `${programId}-sample-${index}`,
        name,
        status: index < 2 ? 'planned' : 'template',
      })),
    [programId],
  );

  if (!useCase) return null;
  if (!program) {
    return <Navigate to="/studio/marketing" replace />;
  }

  return (
    <UseCaseHomeShell
      brand={brand}
      useCase={useCase}
      backHref="/studio/marketing"
      backLabel="All programs"
      badge={
        <div className="mt-4 inline-flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-sm font-medium text-teal-800">
            <Target className="h-4 w-4 text-teal-600" />
            Acquisition Workspace
          </span>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {program.familyLabel}
          </span>
        </div>
      }
      title={program.name}
      description={`${program.tagline}. Phase 1 Acquire only — campaigns and channels produce Program Interest for Education to pull, not enrollment.`}
      primaryAction={
        <>
          <Link
            to="/studio/acquisition"
            className="btn-atrisi-primary inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm"
          >
            Live WhatsApp timelines
            <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="https://atrisi.org/programs"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-teal-300"
          >
            Public program page
          </a>
        </>
      }
      secondaryPanelTitle="Output: Program Interest"
      secondaryPanelBody="Person · Program · Source · Evidence · Intent. Education converts; this workspace acquires."
      secondaryPanelContent={
        <div className="space-y-2 text-sm text-slate-200">
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            <div className="text-xs uppercase tracking-wide text-teal-200/80">Phases</div>
            <div className="mt-1">{ONTOLOGY.phases.acquire}</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            <div className="text-xs uppercase tracking-wide text-teal-200/80">Dogfood</div>
            <div className="mt-1">
              {program.id === PRIMARY_GROWTH_PROGRAM.id ? 'Primary dogfood program' : 'Catalog program'}
            </div>
          </div>
        </div>
      }
    >
      <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        {TABS.map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${
                active
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </div>

      {tab === 'overview' && (
        <section className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
            <h2 className="text-xl font-semibold text-slate-950">Program context</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{program.summary}</p>
            {program.tracks && (
              <p className="mt-3 text-sm text-slate-500">{program.tracks.join(' · ')}</p>
            )}
            <div className="mt-5">
              <div className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                Audiences
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {program.audiences.map((audience) => (
                  <span
                    key={audience}
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700"
                  >
                    {audience}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Sprint status</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li className="font-medium text-teal-800">✓ Sprint 1 — this workspace (static)</li>
              <li>Sprint 2 — Campaign CRUD</li>
              <li>Sprint 3 — Creative Projects + Assets</li>
              <li>Sprint 4 — Publishing Jobs</li>
              <li>Sprint 7 — Program Interest API</li>
            </ul>
          </div>
        </section>
      )}

      {tab === 'campaigns' && (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">Campaigns</h2>
              <p className="mt-1 text-sm text-slate-600">
                Program-scoped intent templates. CRUD lands in Sprint 2 — placeholders below.
              </p>
            </div>
            <button
              type="button"
              disabled
              className="inline-flex cursor-not-allowed items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-400"
            >
              New campaign
            </button>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {sampleCampaigns.map((campaign) => (
              <div
                key={campaign.id}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium text-slate-950">{campaign.name}</div>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 ring-1 ring-slate-200">
                    {campaign.status}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-500">Under {program.name}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === 'channels' && (
        <PlaceholderPanel
          title="Channels"
          body="Business destinations for this Program’s acquisition (WhatsApp, LinkedIn, ads, email, events). Live inbound WhatsApp already runs under Acquisition Intelligence — wire program attribution next."
          nextSprint="Sprint 5 — one outbound connector · keep WhatsApp inbound live"
        />
      )}

      {tab === 'assets' && (
        <PlaceholderPanel
          title="Assets"
          body="Upload posters, Canva/Figma exports, and creatives under campaigns. AI image generation is postponed — manual assets still validate the architecture."
          nextSprint="Sprint 3 — Creative Projects + Assets"
        />
      )}

      {tab === 'analytics' && (
        <PlaceholderPanel
          title="Analytics"
          body="North star is Program Interest and attributed engagement — not vanity likes. Cross-program rollups stay in the Brain."
          nextSprint="Sprint 6–7 — Timeline attribution + Program Interest API"
        />
      )}
    </UseCaseHomeShell>
  );
}
