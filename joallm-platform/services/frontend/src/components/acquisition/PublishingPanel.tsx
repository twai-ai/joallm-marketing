import { useCallback, useEffect, useState } from 'react';
import { Loader2, Send, Trash2 } from 'lucide-react';
import type { AcquisitionCampaign, ChannelKind } from '@joallm/shared';
import { apiClient } from '../../utils/api-client';
import { showError, showSuccess } from '../../utils/toast';

type PublishingJobRow = {
  id: string;
  campaignId: string | null;
  marketingAssetId: string;
  channelId: string;
  channelKind?: string;
  channelName?: string;
  status: string;
  payload: Record<string, unknown>;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

const CHANNEL_OPTIONS: { kind: ChannelKind; label: string }[] = [
  { kind: 'linkedin_organic', label: 'LinkedIn' },
  { kind: 'instagram_organic', label: 'Instagram' },
  { kind: 'whatsapp', label: 'WhatsApp' },
  { kind: 'website', label: 'Website' },
  { kind: 'email', label: 'Email' },
  { kind: 'meta_ads', label: 'Meta Ads' },
];

function statusClass(status: string) {
  if (status === 'queued') return 'bg-amber-50 text-amber-800 ring-1 ring-amber-200/80';
  if (status === 'published') return 'bg-teal-50 text-teal-800 ring-1 ring-teal-200/80';
  if (status === 'failed') return 'bg-rose-50 text-rose-700 ring-1 ring-rose-200/80';
  if (status === 'cancelled') return 'bg-slate-100 text-slate-500 ring-1 ring-slate-200/80';
  return 'bg-white text-slate-600 ring-1 ring-slate-200/80';
}

export function PublishingPanel({
  programId,
  campaigns,
}: {
  programId: string;
  campaigns: AcquisitionCampaign[];
}) {
  const [jobs, setJobs] = useState<PublishingJobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [campaignFilter, setCampaignFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const path = campaignFilter
        ? `/api/acquisition/programs/${encodeURIComponent(programId)}/campaigns/${campaignFilter}/publishing-jobs`
        : `/api/acquisition/programs/${encodeURIComponent(programId)}/publishing-jobs`;
      const res = await apiClient.get<{ success: boolean; data: PublishingJobRow[] }>(path);
      setJobs(res.data || []);
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to load publishing jobs');
    } finally {
      setLoading(false);
    }
  }, [programId, campaignFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const cancelJob = async (job: PublishingJobRow) => {
    try {
      await apiClient.patch(
        `/api/acquisition/programs/${encodeURIComponent(programId)}/publishing-jobs/${job.id}`,
        { status: 'cancelled' },
      );
      showSuccess('Job cancelled');
      await load();
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to cancel job');
    }
  };

  const deleteJob = async (job: PublishingJobRow) => {
    if (!window.confirm('Delete this publishing job?')) return;
    try {
      await apiClient.delete(
        `/api/acquisition/programs/${encodeURIComponent(programId)}/publishing-jobs/${job.id}`,
      );
      showSuccess('Job deleted');
      await load();
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to delete job');
    }
  };

  return (
    <section className="space-y-4">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <Send className="mt-0.5 h-5 w-5 text-teal-700" />
          <div>
            <h2 className="text-xl font-semibold text-slate-950">Publishing Jobs</h2>
            <p className="mt-1 text-sm text-slate-600">
              Queue assets to channels. Jobs are recorded as draft/queued — live send lands in Sprint
              5 (outbound connector).
            </p>
            <p className="mt-2 font-mono text-xs text-slate-500">
              Intent → Campaign → Asset → Publish → (connector) → Engagement
            </p>
          </div>
        </div>

        {campaigns.length > 0 && (
          <label className="mt-4 block max-w-md text-sm">
            <span className="text-xs font-medium text-slate-600">Filter by campaign</span>
            <select
              value={campaignFilter}
              onChange={(e) => setCampaignFilter(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-400"
            >
              <option value="">All campaigns</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading jobs…
          </div>
        ) : jobs.length === 0 ? (
          <p className="text-sm text-slate-600">
            No publishing jobs yet. Open Assets, upload a creative, then click Publish and pick a
            channel.
          </p>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => {
              const title =
                typeof job.payload.assetTitle === 'string'
                  ? job.payload.assetTitle
                  : job.marketingAssetId.slice(0, 8);
              const campaignName =
                typeof job.payload.campaignName === 'string' ? job.payload.campaignName : null;
              return (
                <div
                  key={job.id}
                  className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium text-slate-950">{title}</div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {job.channelName || job.channelKind || 'channel'}
                      {campaignName ? ` · ${campaignName}` : ''}
                      {' · '}
                      {new Date(job.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusClass(job.status)}`}
                    >
                      {job.status}
                    </span>
                    {job.status === 'queued' || job.status === 'draft' ? (
                      <button
                        type="button"
                        onClick={() => void cancelJob(job)}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700"
                      >
                        Cancel
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void deleteJob(job)}
                      className="inline-flex items-center gap-1 rounded-lg border border-rose-100 bg-white px-2 py-1 text-xs font-medium text-rose-700"
                    >
                      <Trash2 className="h-3 w-3" />
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p className="text-xs text-slate-500">
        Channels available to queue: {CHANNEL_OPTIONS.map((c) => c.label).join(' · ')}
      </p>
    </section>
  );
}

export { CHANNEL_OPTIONS };
