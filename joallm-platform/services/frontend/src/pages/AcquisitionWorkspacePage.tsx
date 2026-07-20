import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from 'react';
import {
  ArrowRight,
  BarChart3,
  Compass,
  Image as ImageIcon,
  LayoutDashboard,
  Loader2,
  Megaphone,
  Pencil,
  Plus,
  Radio,
  Send,
  Target,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { Link, Navigate, useParams } from 'react-router-dom';
import type {
  AcquisitionCampaign,
  AcquisitionCampaignStatus,
  GrowthIntent,
  GrowthIntentId,
} from '@joallm/shared';
import { AssetsPanel } from '../components/acquisition/AssetsPanel';
import { PublishingPanel } from '../components/acquisition/PublishingPanel';
import { UseCaseHomeShell } from '../components/use-cases/UseCaseHomeShell';
import { getUseCaseById } from '../constants/useCases';
import { getProgramById, PRIMARY_GROWTH_PROGRAM } from '../constants/programs';
import { getIntentById, getIntentsForProgram } from '../constants/growthIntents';
import { ONTOLOGY } from '../constants/ontology';
import { apiClient } from '../utils/api-client';
import { showError, showSuccess } from '../utils/toast';

type WorkspaceTab =
  | 'overview'
  | 'intents'
  | 'campaigns'
  | 'channels'
  | 'assets'
  | 'publishing'
  | 'analytics';

const TABS: { id: WorkspaceTab; label: string; icon: typeof Megaphone }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'intents', label: 'Intents', icon: Compass },
  { id: 'campaigns', label: 'Campaigns', icon: Megaphone },
  { id: 'channels', label: 'Channels', icon: Radio },
  { id: 'assets', label: 'Assets', icon: ImageIcon },
  { id: 'publishing', label: 'Publishing', icon: Send },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
];

const STATUS_OPTIONS: AcquisitionCampaignStatus[] = [
  'draft',
  'active',
  'paused',
  'completed',
  'archived',
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

function useProgramCampaigns(programId: string) {
  const [campaigns, setCampaigns] = useState<AcquisitionCampaign[]>([]);
  const [loading, setLoading] = useState(true);

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

  return { campaigns, loading, reload: load, setCampaigns };
}

function IntentsPanel({
  programId,
  campaigns,
  loading,
  onOpenIntent,
}: {
  programId: string;
  campaigns: AcquisitionCampaign[];
  loading: boolean;
  onOpenIntent: (intentId: GrowthIntentId) => void;
}) {
  const intents = useMemo(() => getIntentsForProgram(programId), [programId]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const campaign of campaigns) {
      if (!campaign.intentId) continue;
      map.set(campaign.intentId, (map.get(campaign.intentId) || 0) + 1);
    }
    return map;
  }, [campaigns]);

  return (
    <section className="space-y-4">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-950">Growth Intents</h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Durable reasons to communicate about this Program. Campaigns are time-bound executions of
          an Intent — not free-floating marketing activities.
        </p>
        <p className="mt-2 font-mono text-xs text-slate-500">
          Program → Intent → Campaign → Creative → Assets → Publishing
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {intents.map((intent) => {
            const count = counts.get(intent.id) || 0;
            return (
              <button
                key={intent.id}
                type="button"
                onClick={() => onOpenIntent(intent.id)}
                className="rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-teal-300 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-lg font-semibold text-slate-950">{intent.name}</h3>
                  <span className="shrink-0 rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-800 ring-1 ring-teal-200/80">
                    {count} campaign{count === 1 ? '' : 's'}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{intent.purpose}</p>
                {intent.cta && (
                  <div className="mt-3 inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                    CTA · {intent.cta}
                  </div>
                )}
                <div className="mt-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">
                    Examples
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {intent.examples.slice(0, 4).join(' · ')}
                    {intent.examples.length > 4 ? '…' : ''}
                  </p>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {intent.assetTemplates.slice(0, 5).map((template) => (
                    <span
                      key={template}
                      className="rounded-md border border-slate-100 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-500"
                    >
                      {template}
                    </span>
                  ))}
                  {intent.assetTemplates.length > 5 && (
                    <span className="rounded-md px-2 py-0.5 text-[10px] text-slate-400">
                      +{intent.assetTemplates.length - 5}
                    </span>
                  )}
                </div>
                <div className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-teal-800">
                  Open campaigns
                  <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

function CampaignsPanel({
  programId,
  programName,
  intents,
  filterIntentId,
  onClearFilter,
  campaigns,
  loading,
  reload,
  setCampaigns,
  onUploadAssets,
}: {
  programId: string;
  programName: string;
  intents: GrowthIntent[];
  filterIntentId: GrowthIntentId | null;
  onClearFilter: () => void;
  campaigns: AcquisitionCampaign[];
  loading: boolean;
  reload: () => Promise<void>;
  setCampaigns: Dispatch<SetStateAction<AcquisitionCampaign[]>>;
  onUploadAssets: (campaignId: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [channel, setChannel] = useState('');
  const [status, setStatus] = useState<AcquisitionCampaignStatus>('draft');
  const [intentId, setIntentId] = useState<GrowthIntentId | ''>(filterIntentId || '');

  useEffect(() => {
    if (filterIntentId) {
      setIntentId(filterIntentId);
    }
  }, [filterIntentId]);

  const filterIntent = filterIntentId
    ? getIntentById(programId, filterIntentId)
    : undefined;

  const visible = useMemo(() => {
    if (!filterIntentId) return campaigns;
    return campaigns.filter((c) => c.intentId === filterIntentId);
  }, [campaigns, filterIntentId]);

  const grouped = useMemo(() => {
    if (filterIntentId) return null;
    const byIntent = new Map<string, AcquisitionCampaign[]>();
    const unassigned: AcquisitionCampaign[] = [];
    for (const campaign of campaigns) {
      if (!campaign.intentId) {
        unassigned.push(campaign);
        continue;
      }
      const list = byIntent.get(campaign.intentId) || [];
      list.push(campaign);
      byIntent.set(campaign.intentId, list);
    }
    return { byIntent, unassigned };
  }, [campaigns, filterIntentId]);

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setName('');
    setChannel('');
    setStatus('draft');
    setIntentId(filterIntentId || '');
  };

  const openCreate = () => {
    setEditingId(null);
    setName('');
    setChannel('');
    setStatus('draft');
    setIntentId(filterIntentId || (intents[0]?.id ?? ''));
    setShowForm(true);
  };

  const openEdit = (campaign: AcquisitionCampaign) => {
    setEditingId(campaign.id);
    setName(campaign.name);
    setChannel(campaign.channel || '');
    setStatus(campaign.status);
    setIntentId(campaign.intentId || filterIntentId || '');
    setShowForm(true);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      showError('Campaign name is required');
      return;
    }
    if (!intentId) {
      showError('Select a Growth Intent — campaigns execute an Intent');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await apiClient.patch<{ success: boolean; data: AcquisitionCampaign }>(
          `/api/acquisition/programs/${encodeURIComponent(programId)}/campaigns/${editingId}`,
          {
            name: name.trim(),
            intentId,
            channel: channel.trim() || null,
            status,
          },
        );
        showSuccess('Campaign updated');
      } else {
        await apiClient.post<{ success: boolean; data: AcquisitionCampaign }>(
          `/api/acquisition/programs/${encodeURIComponent(programId)}/campaigns`,
          {
            name: name.trim(),
            programName,
            intentId,
            channel: channel.trim() || undefined,
            status,
          },
        );
        showSuccess('Campaign created');
      }
      resetForm();
      await reload();
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
      await reload();
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

  const renderCard = (campaign: AcquisitionCampaign) => {
    const intent = campaign.intentId
      ? getIntentById(programId, campaign.intentId)
      : undefined;
    return (
      <div
        key={campaign.id}
        className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate font-medium text-slate-950">{campaign.name}</div>
            {intent && (
              <div className="mt-0.5 text-xs text-teal-800">{intent.name}</div>
            )}
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
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            value={campaign.status}
            onChange={(e) =>
              void handleStatusChange(campaign, e.target.value as AcquisitionCampaignStatus)
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
            onClick={() => onUploadAssets(campaign.id)}
            className="inline-flex items-center gap-1 rounded-lg border border-teal-200 bg-teal-50 px-2 py-1 text-xs font-medium text-teal-800 hover:border-teal-400"
          >
            <Upload className="h-3 w-3" />
            Upload
          </button>
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
    );
  };

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">
            {filterIntent ? `${filterIntent.name} campaigns` : 'Campaigns'}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {filterIntent
              ? `Time-bound executions of ${filterIntent.name} under ${programName}.`
              : `Time-bound executions of Growth Intents under ${programName}.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {filterIntentId && (
            <button
              type="button"
              onClick={onClearFilter}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700"
            >
              All intents
            </button>
          )}
          <button
            type="button"
            onClick={openCreate}
            className="btn-atrisi-primary inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm"
          >
            <Plus className="h-4 w-4" />
            New campaign
          </button>
        </div>
      </div>

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
              <span className="text-xs font-medium text-slate-600">Growth Intent</span>
              <select
                value={intentId}
                onChange={(e) => setIntentId(e.target.value as GrowthIntentId)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-400"
                required
              >
                <option value="" disabled>
                  Select intent…
                </option>
                {intents.map((intent) => (
                  <option key={intent.id} value={intent.id}>
                    {intent.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="text-xs font-medium text-slate-600">Campaign name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-400"
                placeholder="e.g. July 2026 Cohort"
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
      ) : filterIntentId ? (
        visible.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
            No campaigns for this Intent yet. Create one to execute it in time.
          </div>
        ) : (
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visible.map(renderCard)}
          </div>
        )
      ) : campaigns.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
          No campaigns yet. Pick an Intent, then create a time-bound campaign under it.
        </div>
      ) : (
        <div className="mt-5 space-y-6">
          {intents.map((intent) => {
            const list = grouped?.byIntent.get(intent.id) || [];
            if (list.length === 0) return null;
            return (
              <div key={intent.id}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">{intent.name}</h3>
                  <span className="text-xs text-slate-500">
                    {list.length} campaign{list.length === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {list.map(renderCard)}
                </div>
              </div>
            );
          })}
          {grouped && grouped.unassigned.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-900">Unassigned</h3>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {grouped.unassigned.map(renderCard)}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export function AcquisitionWorkspacePage() {
  const { programId = '' } = useParams<{ programId: string }>();
  const useCase = getUseCaseById('marketing-studio');
  const program = getProgramById(programId);
  const [tab, setTab] = useState<WorkspaceTab>('intents');
  const [filterIntentId, setFilterIntentId] = useState<GrowthIntentId | null>(null);
  const [assetsCampaignId, setAssetsCampaignId] = useState<string | null>(null);

  const brand = program?.id === 'amplify-with-ai' ? 'amplify' : 'institutional';
  const intents = useMemo(
    () => (program ? getIntentsForProgram(program.id) : []),
    [program],
  );
  const { campaigns, loading, reload, setCampaigns } = useProgramCampaigns(
    program?.id || programId,
  );

  if (!useCase) return null;
  if (!program) {
    return <Navigate to="/studio/marketing" replace />;
  }

  const openIntentCampaigns = (intentId: GrowthIntentId) => {
    setFilterIntentId(intentId);
    setTab('campaigns');
  };

  const openAssetsForCampaign = (campaignId: string) => {
    setAssetsCampaignId(campaignId);
    setTab('assets');
  };

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
      description={`${program.tagline}. Organize by Growth Intents first — campaigns are time-bound executions that produce Program Interest for Education.`}
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
              {program.id === PRIMARY_GROWTH_PROGRAM.id
                ? `${intents.length} Amplify Growth Intents`
                : 'Catalog program intents'}
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
            <div className="mt-5 rounded-2xl border border-teal-100 bg-teal-50/50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.15em] text-teal-800">
                Organizing principle
              </div>
              <p className="mt-2 font-mono text-xs leading-5 text-slate-700">
                Program → Intent → Campaign → Creative → Assets → Publishing → Program Interest
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Intents are durable (Registration, Events, Community…). Campaigns are time-bound
                (July Launch, Early Bird). Start from the Intents tab.
              </p>
            </div>
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
              <li className="font-medium text-teal-800">✓ Sprint 2b — Intent catalog</li>
              <li className="font-medium text-teal-800">✓ Sprint 3 — Creative Projects + Assets</li>
              <li className="font-medium text-teal-800">✓ Sprint 4 — Publishing Jobs</li>
              <li>Sprint 5 — Outbound connector</li>
              <li>Sprint 7 — Program Interest API</li>
            </ul>
          </div>
        </section>
      )}

      {tab === 'intents' && (
        <IntentsPanel
          programId={program.id}
          campaigns={campaigns}
          loading={loading}
          onOpenIntent={openIntentCampaigns}
        />
      )}

      {tab === 'campaigns' && (
        <CampaignsPanel
          programId={program.id}
          programName={program.name}
          intents={intents}
          filterIntentId={filterIntentId}
          onClearFilter={() => setFilterIntentId(null)}
          campaigns={campaigns}
          loading={loading}
          reload={reload}
          setCampaigns={setCampaigns}
          onUploadAssets={openAssetsForCampaign}
        />
      )}

      {tab === 'channels' && (
        <PlaceholderPanel
          title="Channels"
          body="Business destinations for this Program’s acquisition (WhatsApp, LinkedIn, ads, email, events). Live inbound WhatsApp already runs under Acquisition Intelligence — wire program attribution next."
          nextSprint="Sprint 5 — one outbound connector · keep WhatsApp inbound live"
        />
      )}

      {tab === 'assets' && (
        <AssetsPanel
          programId={program.id}
          programName={program.name}
          campaigns={campaigns}
          campaignsLoading={loading}
          preferredCampaignId={assetsCampaignId}
          onCampaignsChanged={reload}
          onGoToCampaigns={() => setTab('campaigns')}
          onGoToPublishing={() => setTab('publishing')}
        />
      )}

      {tab === 'publishing' && (
        <PublishingPanel programId={program.id} campaigns={campaigns} />
      )}

      {tab === 'analytics' && (
        <PlaceholderPanel
          title="Analytics"
          body="North star is Program Interest and attributed engagement — not vanity likes. Roll up by Intent, then Campaign."
          nextSprint="Sprint 6–7 — Timeline attribution + Program Interest API"
        />
      )}
    </UseCaseHomeShell>
  );
}
