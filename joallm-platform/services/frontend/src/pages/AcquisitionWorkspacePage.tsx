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
  HeartHandshake,
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
import { InterestsPanel } from '../components/acquisition/InterestsPanel';
import { PublishingPanel } from '../components/acquisition/PublishingPanel';
import { UseCaseHomeShell } from '../components/use-cases/UseCaseHomeShell';
import { getUseCaseById } from '../constants/useCases';
import { getProgramById } from '../constants/programs';
import { getIntentById, getIntentsForProgram } from '../constants/growthIntents';
import { apiClient } from '../utils/api-client';
import { showError, showSuccess } from '../utils/toast';

type WorkspaceTab =
  | 'overview'
  | 'intents'
  | 'campaigns'
  | 'channels'
  | 'assets'
  | 'publishing'
  | 'interests'
  | 'analytics';

const TABS: { id: WorkspaceTab; label: string; hint: string; icon: typeof Megaphone }[] = [
  { id: 'overview', label: 'Start here', hint: 'How this workspace works', icon: LayoutDashboard },
  { id: 'intents', label: 'Goals', hint: 'Why you reach out', icon: Compass },
  { id: 'campaigns', label: 'Campaigns', hint: 'Time-bound plans', icon: Megaphone },
  { id: 'channels', label: 'Channels', hint: 'Where you publish', icon: Radio },
  { id: 'assets', label: 'Creatives', hint: 'Images & copy', icon: ImageIcon },
  { id: 'publishing', label: 'Publish', hint: 'Send & schedule', icon: Send },
  { id: 'interests', label: 'Interest', hint: 'Who engaged', icon: HeartHandshake },
  { id: 'analytics', label: 'Results', hint: 'Quick snapshot', icon: BarChart3 },
];

function statusClass(status: string) {
  if (status === 'active') return 'bg-teal-50 text-teal-800 ring-1 ring-teal-200/80';
  if (status === 'paused') return 'bg-amber-50 text-amber-800 ring-1 ring-amber-200/80';
  if (status === 'completed') return 'bg-sky-50 text-sky-800 ring-1 ring-sky-200/80';
  if (status === 'archived') return 'bg-slate-100 text-slate-500 ring-1 ring-slate-200/80';
  return 'bg-white text-slate-600 ring-1 ring-slate-200/80';
}

const STATUS_OPTIONS: AcquisitionCampaignStatus[] = [
  'draft',
  'active',
  'paused',
  'completed',
  'archived',
];

function ChannelsPanel({ onGoToInbox }: { onGoToInbox: () => void }) {
  const [channels, setChannels] = useState<
    Array<{ id: string; name: string; kind: string; status: string }>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await apiClient.get<{
          success: boolean;
          data: Array<{ id: string; name: string; kind: string; status: string }>;
        }>('/api/studio/channels');
        if (!cancelled) setChannels(res.data || []);
      } catch {
        if (!cancelled) setChannels([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const kinds = [
    { kind: 'whatsapp', label: 'WhatsApp', use: 'Replies and outreach messages' },
    { kind: 'facebook_organic', label: 'Facebook Page', use: 'Organic posts from creatives' },
    { kind: 'instagram_organic', label: 'Instagram', use: 'Organic posts from creatives' },
    { kind: 'meta_ads', label: 'Meta Ads', use: 'Paused ads / creatives from Publish' },
    { kind: 'linkedin_organic', label: 'LinkedIn', use: 'Simulated until connector is live' },
    { kind: 'email', label: 'Email', use: 'Simulated until connector is live' },
  ];

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="app-display text-xl font-semibold text-slate-950">Where campaigns go out</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
          Channels are the destinations you publish to. Connect them once in People & inbox, then
          use Creatives → Publish here.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            to="/studio/people"
            onClick={onGoToInbox}
            className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Open People & inbox to connect
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading channels…
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {kinds.map((item) => {
            const bound = channels.find((c) => c.kind === item.kind);
            return (
              <div
                key={item.kind}
                className="flex items-start justify-between gap-3 border border-slate-200 bg-white px-4 py-4"
              >
                <div>
                  <div className="font-medium text-slate-950">{item.label}</div>
                  <p className="mt-1 text-xs text-slate-500">{item.use}</p>
                  {bound && (
                    <p className="mt-2 text-xs font-medium text-teal-800">{bound.name}</p>
                  )}
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                    bound?.status === 'active'
                      ? 'bg-teal-50 text-teal-800'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {bound ? bound.status : 'Not bound'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function AnalyticsPanel({
  campaigns,
  onGoToInterest,
  onGoToInbox,
}: {
  campaigns: AcquisitionCampaign[];
  onGoToInterest: () => void;
  onGoToInbox: () => void;
}) {
  const byStatus = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of campaigns) {
      map[c.status] = (map[c.status] || 0) + 1;
    }
    return map;
  }, [campaigns]);

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="app-display text-xl font-semibold text-slate-950">Results snapshot</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
          Campaign counts live here. Detailed engagement (who replied or submitted a lead) is in
          Interest and People & inbox.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Total campaigns', String(campaigns.length)],
          ['Active', String(byStatus.active || 0)],
          ['Draft', String(byStatus.draft || 0)],
          ['Paused', String(byStatus.paused || 0)],
        ].map(([label, value]) => (
          <div key={label} className="border border-slate-200 bg-white px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {label}
            </div>
            <div className="mt-1 text-2xl font-semibold text-slate-950">{value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <button
          type="button"
          onClick={onGoToInterest}
          className="border border-slate-200 bg-white px-5 py-4 text-left transition hover:border-teal-300"
        >
          <div className="font-medium text-slate-950">View Program Interest</div>
          <p className="mt-1 text-sm text-slate-500">
            People who engaged after publish or inbound WhatsApp attribution.
          </p>
        </button>
        <Link
          to="/studio/people"
          onClick={onGoToInbox}
          className="border border-slate-200 bg-white px-5 py-4 text-left transition hover:border-teal-300"
        >
          <div className="font-medium text-slate-950">Open People & inbox</div>
          <p className="mt-1 text-sm text-slate-500">
            Read conversations and sync Meta ad insights.
          </p>
        </Link>
      </div>
    </section>
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
        <h2 className="text-xl font-semibold text-slate-950">Goals for this program</h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Why you reach out. Click a goal to open Campaigns filtered to it — then create a
          time-bound campaign.
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
  const [tab, setTab] = useState<WorkspaceTab>('overview');
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
    return <Navigate to="/studio/campaigns" replace />;
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
      backHref="/studio/campaigns"
      backLabel="All programs"
      badge={
        <div className="mt-4 inline-flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-sm font-medium text-teal-800">
            <Target className="h-4 w-4 text-teal-600" />
            Campaigns workspace
          </span>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {program.familyLabel}
          </span>
        </div>
      }
      title={program.name}
      description="Plan outreach for this program: pick a goal, create a campaign, make a creative, then publish. Replies show up in People & inbox."
      primaryAction={
        <>
          <button
            type="button"
            onClick={() => setTab('campaigns')}
            className="btn-atrisi-primary inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm"
          >
            Create or open campaigns
            <ArrowRight className="h-4 w-4" />
          </button>
          <Link
            to="/studio/people"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-teal-300"
          >
            People & inbox
          </Link>
        </>
      }
      secondaryPanelTitle="How to use this"
      secondaryPanelBody="Follow the tabs left to right the first time. After that, jump to Campaigns or Creatives."
      secondaryPanelContent={
        <ol className="space-y-2 text-sm text-slate-200">
          {[
            'Goals — why you are reaching out',
            'Campaigns — name a time-bound plan',
            'Creatives — generate or upload assets',
            'Publish — send to WhatsApp / Meta',
            'Interest — see who engaged',
          ].map((step, i) => (
            <li
              key={step}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2"
            >
              <span className="text-teal-200">{i + 1}.</span> {step}
            </li>
          ))}
        </ol>
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
              title={item.hint}
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
        <section className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="app-display text-xl font-semibold text-slate-950">
              Start here — {program.name}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
              {program.summary}
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {[
              {
                step: '1',
                title: 'Pick a goal',
                body: 'Open Goals and choose why you are reaching out (registration, events, community…).',
                action: () => setTab('intents'),
                cta: 'Open Goals',
              },
              {
                step: '2',
                title: 'Create a campaign',
                body: 'Name a time-bound plan under that goal. You can stay in draft until ready.',
                action: () => setTab('campaigns'),
                cta: 'Open Campaigns',
              },
              {
                step: '3',
                title: 'Make a creative',
                body: 'Generate or upload an image/copy for the campaign, then Publish to a channel.',
                action: () => setTab('assets'),
                cta: 'Open Creatives',
              },
              {
                step: '4',
                title: 'Watch replies',
                body: 'Inbound WhatsApp / leads appear in People & inbox for the whole team.',
                action: () => undefined,
                href: '/studio/people',
                cta: 'Open inbox',
              },
            ].map((card) => (
              <div
                key={card.step}
                className="flex flex-col border border-slate-200 bg-white p-5"
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-800">
                  Step {card.step}
                </div>
                <h3 className="mt-2 font-semibold text-slate-950">{card.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">{card.body}</p>
                {card.href ? (
                  <Link
                    to={card.href}
                    className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-teal-800 hover:text-teal-950"
                  >
                    {card.cta} <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={card.action}
                    className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-teal-800 hover:text-teal-950"
                  >
                    {card.cta} <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-600">
            <span className="font-semibold text-slate-900">{campaigns.length}</span> campaign
            {campaigns.length === 1 ? '' : 's'} on this program
            {campaigns.length === 0
              ? ' — create your first one in Campaigns.'
              : '. Jump to Campaigns anytime to edit or publish.'}
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

      {tab === 'channels' && <ChannelsPanel onGoToInbox={() => undefined} />}

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
        <PublishingPanel
          programId={program.id}
          campaigns={campaigns}
          onGoToAssets={() => setTab('assets')}
        />
      )}

      {tab === 'interests' && <InterestsPanel programId={program.id} />}

      {tab === 'analytics' && (
        <AnalyticsPanel
          campaigns={campaigns}
          onGoToInterest={() => setTab('interests')}
          onGoToInbox={() => undefined}
        />
      )}
    </UseCaseHomeShell>
  );
}
