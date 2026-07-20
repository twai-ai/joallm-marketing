import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  ArrowRight,
  BarChart3,
  Image as ImageIcon,
  LayoutDashboard,
  Loader2,
  Megaphone,
  Pencil,
  Plus,
  Radio,
  Target,
  Trash2,
  X,
} from 'lucide-react';
import { Link, Navigate, useParams } from 'react-router-dom';
import type {
  AcquisitionCampaign,
  AcquisitionCampaignStatus,
} from '@joallm/shared';
import { UseCaseHomeShell } from '../components/use-cases/UseCaseHomeShell';
import { getUseCaseById } from '../constants/useCases';
import { getProgramById, PRIMARY_GROWTH_PROGRAM } from '../constants/programs';
import { ONTOLOGY } from '../constants/ontology';
import { apiClient } from '../utils/api-client';
import { showError, showSuccess } from '../utils/toast';

type WorkspaceTab = 'overview' | 'campaigns' | 'channels' | 'assets' | 'analytics';

const TABS: { id: WorkspaceTab; label: string; icon: typeof Megaphone }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'campaigns', label: 'Campaigns', icon: Megaphone },
  { id: 'channels', label: 'Channels', icon: Radio },
  { id: 'assets', label: 'Assets', icon: ImageIcon },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
];

const STATUS_OPTIONS: AcquisitionCampaignStatus[] = [
  'draft',
  'active',
  'paused',
  'completed',
  'archived',
];

/** Suggested intents for dogfood Amplify — create real campaigns, not placeholders */
const SUGGESTED_INTENTS = [
  'Early Bird',
  'Campus Ambassador',
  'Faculty Referral',
  'Women in AI',
  'Hackathon',
  'Final Call',
];

function statusClass(status: string) {
  if (status === 'active') return 'bg-teal-50 text-teal-800 ring-1 ring-teal-200/80';
  if (status === 'paused') return 'bg-amber-50 text-amber-800 ring-1 ring-amber-200/80';
  if (status === 'completed') return 'bg-sky-50 text-sky-800 ring-1 ring-sky-200/80';
  if (status === 'archived') return 'bg-slate-100 text-slate-500 ring-1 ring-slate-200/80';
  return 'bg-white text-slate-600 ring-1 ring-slate-200/80';
}

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

function CampaignsPanel({
  programId,
  programName,
}: {
  programId: string;
  programName: string;
}) {
  const [campaigns, setCampaigns] = useState<AcquisitionCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [channel, setChannel] = useState('');
  const [status, setStatus] = useState<AcquisitionCampaignStatus>('draft');
  const [intentTemplate, setIntentTemplate] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<{ success: boolean; data: AcquisitionCampaign[] }>(
        `/api/acquisition/programs/${encodeURIComponent(programId)}/campaigns`,
      );
      setCampaigns(res.data || []);
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  }, [programId]);

  useEffect(() => {
    void load();
  }, [load]);

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setName('');
    setChannel('');
    setStatus('draft');
    setIntentTemplate('');
  };

  const openCreate = (suggestedName?: string) => {
    setEditingId(null);
    setName(suggestedName || '');
    setChannel('');
    setStatus('draft');
    setIntentTemplate(suggestedName || '');
    setShowForm(true);
  };

  const openEdit = (campaign: AcquisitionCampaign) => {
    setEditingId(campaign.id);
    setName(campaign.name);
    setChannel(campaign.channel || '');
    setStatus(campaign.status);
    setIntentTemplate(campaign.intentTemplate || '');
    setShowForm(true);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      showError('Campaign name is required');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await apiClient.patch<{ success: boolean; data: AcquisitionCampaign }>(
          `/api/acquisition/programs/${encodeURIComponent(programId)}/campaigns/${editingId}`,
          {
            name: name.trim(),
            channel: channel.trim() || null,
            status,
            intentTemplate: intentTemplate.trim() || undefined,
          },
        );
        showSuccess('Campaign updated');
      } else {
        await apiClient.post<{ success: boolean; data: AcquisitionCampaign }>(
          `/api/acquisition/programs/${encodeURIComponent(programId)}/campaigns`,
          {
            name: name.trim(),
            programName,
            channel: channel.trim() || undefined,
            status,
            intentTemplate: intentTemplate.trim() || undefined,
          },
        );
        showSuccess('Campaign created');
      }
      resetForm();
      await load();
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to save campaign');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (campaign: AcquisitionCampaign) => {
    if (!window.confirm(`Delete campaign “${campaign.name}”?`)) return;
    try {
      await apiClient.delete(
        `/api/acquisition/programs/${encodeURIComponent(programId)}/campaigns/${campaign.id}`,
      );
      showSuccess('Campaign deleted');
      if (editingId === campaign.id) resetForm();
      await load();
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to delete campaign');
    }
  };

  const handleStatusChange = async (
    campaign: AcquisitionCampaign,
    next: AcquisitionCampaignStatus,
  ) => {
    try {
      await apiClient.patch(
        `/api/acquisition/programs/${encodeURIComponent(programId)}/campaigns/${campaign.id}`,
        { status: next },
      );
      setCampaigns((prev) =>
        prev.map((item) => (item.id === campaign.id ? { ...item, status: next } : item)),
      );
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to update status');
    }
  };

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">Campaigns</h2>
          <p className="mt-1 text-sm text-slate-600">
            Program-scoped acquisition intents under {programName}. Education never pulls these
            entities — only Program Interest later.
          </p>
        </div>
        <button
          type="button"
          onClick={() => openCreate()}
          className="btn-atrisi-primary inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm"
        >
          <Plus className="h-4 w-4" />
          New campaign
        </button>
      </div>

      {programId === 'amplify-with-ai' && !showForm && (
        <div className="mt-4">
          <div className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
            Quick create
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {SUGGESTED_INTENTS.map((intent) => (
              <button
                key={intent}
                type="button"
                onClick={() => openCreate(intent)}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 hover:border-teal-300 hover:bg-teal-50"
              >
                {intent}
              </button>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mt-5 rounded-2xl border border-teal-200 bg-teal-50/40 p-4"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-950">
              {editingId ? 'Edit campaign' : 'New campaign'}
            </h3>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-full p-1 text-slate-500 hover:bg-white hover:text-slate-800"
              aria-label="Close form"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-sm sm:col-span-2">
              <span className="text-xs font-medium text-slate-600">Name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-400"
                placeholder="e.g. Early Bird"
                required
              />
            </label>
            <label className="block text-sm">
              <span className="text-xs font-medium text-slate-600">Channel (optional)</span>
              <input
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-400"
                placeholder="whatsapp, linkedin, meta_ads…"
              />
            </label>
            <label className="block text-sm">
              <span className="text-xs font-medium text-slate-600">Status</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as AcquisitionCampaignStatus)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-400"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="text-xs font-medium text-slate-600">Intent template (optional)</span>
              <input
                value={intentTemplate}
                onChange={(e) => setIntentTemplate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-400"
                placeholder="Attribution label for Program Interest"
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={saving}
              className="btn-atrisi-primary inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingId ? 'Save changes' : 'Create campaign'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="mt-8 flex items-center justify-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading campaigns…
        </div>
      ) : campaigns.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
          No campaigns yet. Create one to start acquiring interest for this program.
        </div>
      ) : (
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {campaigns.map((campaign) => (
            <div
              key={campaign.id}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-medium text-slate-950">{campaign.name}</div>
                  {campaign.channel && (
                    <div className="mt-0.5 text-xs text-slate-500">{campaign.channel}</div>
                  )}
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusClass(campaign.status)}`}
                >
                  {campaign.status}
                </span>
              </div>
              {campaign.intentTemplate && (
                <p className="mt-2 text-xs text-slate-500">Intent: {campaign.intentTemplate}</p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <select
                  value={campaign.status}
                  onChange={(e) =>
                    void handleStatusChange(
                      campaign,
                      e.target.value as AcquisitionCampaignStatus,
                    )
                  }
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
                  aria-label={`Status for ${campaign.name}`}
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => openEdit(campaign)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:border-teal-300"
                >
                  <Pencil className="h-3 w-3" />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(campaign)}
                  className="inline-flex items-center gap-1 rounded-lg border border-rose-100 bg-white px-2 py-1 text-xs font-medium text-rose-700 hover:border-rose-300"
                >
                  <Trash2 className="h-3 w-3" />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function AcquisitionWorkspacePage() {
  const { programId = '' } = useParams<{ programId: string }>();
  const useCase = getUseCaseById('marketing-studio');
  const program = getProgramById(programId);
  const [tab, setTab] = useState<WorkspaceTab>('overview');

  const brand = program?.id === 'amplify-with-ai' ? 'amplify' : 'institutional';

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
              <li className="font-medium text-teal-800">✓ Sprint 1 — this workspace</li>
              <li className="font-medium text-teal-800">✓ Sprint 2 — Campaign CRUD</li>
              <li>Sprint 3 — Creative Projects + Assets</li>
              <li>Sprint 4 — Publishing Jobs</li>
              <li>Sprint 7 — Program Interest API</li>
            </ul>
          </div>
        </section>
      )}

      {tab === 'campaigns' && (
        <CampaignsPanel programId={program.id} programName={program.name} />
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
