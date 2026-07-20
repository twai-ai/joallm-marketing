import { useCallback, useEffect, useState } from 'react';
import { HeartHandshake, Loader2 } from 'lucide-react';
import { apiClient } from '../../utils/api-client';
import { showError } from '../../utils/toast';

type InterestRow = {
  id: string;
  personId: string;
  programId: string;
  programName?: string;
  confidence: number;
  source: string;
  campaignId?: string;
  campaignName?: string;
  intent?: string;
  evidence: Array<{ kind: string; summary?: string; channel?: string }>;
  occurredAt: string;
};

export function InterestsPanel({ programId }: { programId: string }) {
  const [interests, setInterests] = useState<InterestRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<{ success: boolean; data: InterestRow[] }>(
        `/api/acquisition/programs/${encodeURIComponent(programId)}/interests?limit=100`,
      );
      setInterests(res.data || []);
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to load Program Interest');
    } finally {
      setLoading(false);
    }
  }, [programId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="space-y-4">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <HeartHandshake className="mt-0.5 h-5 w-5 text-teal-700" />
          <div>
            <h2 className="text-xl font-semibold text-slate-950">Program Interest</h2>
            <p className="mt-1 text-sm text-slate-600">
              The only object Education should pull. Created when creatives publish and when WhatsApp
              inbound attributes to a recent campaign.
            </p>
            <p className="mt-2 font-mono text-xs text-slate-500">
              GET /api/acquisition/program-interests/pull?programId={programId}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading interests…
          </div>
        ) : interests.length === 0 ? (
          <p className="text-sm text-slate-600">
            No Program Interest yet. Publish an asset (Publishing tab) or receive a WhatsApp message
            after a campaign publish.
          </p>
        ) : (
          <div className="space-y-3">
            {interests.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium text-slate-950">
                    {item.campaignName || item.intent || item.programId}
                  </div>
                  <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-800 ring-1 ring-teal-200/80">
                    {(item.confidence * 100).toFixed(0)}% · {item.source}
                  </span>
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Person {item.personId.slice(0, 8)}… · {new Date(item.occurredAt).toLocaleString()}
                </div>
                {item.evidence?.[0]?.summary && (
                  <p className="mt-2 text-sm text-slate-600">{item.evidence[0].summary}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
