import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Link2,
  Loader2,
  MessageSquare,
  Radio,
  RefreshCw,
  Users,
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { UseCaseHomeShell } from '../components/use-cases/UseCaseHomeShell';
import { getUseCaseById } from '../constants/useCases';
import { apiClient } from '../utils/api-client';
import { showError, showSuccess } from '../utils/toast';

interface AcquisitionPerson {
  id: string;
  displayName?: string | null;
  primaryPhone?: string | null;
  primaryEmail?: string | null;
  status: string;
  updatedAt: string;
}

interface AcquisitionInteraction {
  id: string;
  kind: string;
  direction?: string | null;
  summary?: string | null;
  occurredAt: string;
}

interface SourceConnection {
  id: string;
  provider: string;
  name: string;
  status: string;
  externalAccountId?: string | null;
  lastSuccessAt?: string | null;
  lastErrorAt?: string | null;
  lastErrorMessage?: string | null;
}

interface OverviewData {
  people: number;
  events: number;
  interactions: number;
  sources: SourceConnection[];
}

function formatWhen(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

export function AcquisitionIntelligencePage() {
  const useCase = getUseCaseById('acquisition');
  const navigate = useNavigate();
  const { personId } = useParams<{ personId?: string }>();

  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [people, setPeople] = useState<AcquisitionPerson[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<AcquisitionInteraction[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<AcquisitionPerson | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [overviewRes, peopleRes, eventsRes] = await Promise.all([
        apiClient.get<{ success: boolean; data: OverviewData }>('/api/acquisition/overview'),
        apiClient.get<{ success: boolean; data: AcquisitionPerson[] }>('/api/acquisition/people'),
        apiClient.get<{ success: boolean; data: any[] }>('/api/acquisition/events?limit=30'),
      ]);
      setOverview(overviewRes.data);
      setPeople(peopleRes.data || []);
      setEvents(eventsRes.data || []);
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to load Acquisition Intelligence');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTimeline = useCallback(async (id: string) => {
    try {
      const res = await apiClient.get<{
        success: boolean;
        data: { person: AcquisitionPerson; interactions: AcquisitionInteraction[] };
      }>(`/api/acquisition/people/${id}/timeline`);
      setSelectedPerson(res.data.person);
      setTimeline(res.data.interactions || []);
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to load person timeline');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (personId) {
      void loadTimeline(personId);
    } else {
      setSelectedPerson(null);
      setTimeline([]);
    }
  }, [personId, loadTimeline]);

  const metaSource = useMemo(
    () => overview?.sources?.find((source) => source.provider === 'meta_whatsapp'),
    [overview],
  );

  const ensureMetaSource = async () => {
    setConnecting(true);
    try {
      await apiClient.post('/api/acquisition/sources/meta', {});
      showSuccess('Meta WhatsApp source connected');
      await load();
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to connect Meta source');
    } finally {
      setConnecting(false);
    }
  };

  if (!useCase) return null;

  return (
    <UseCaseHomeShell
      useCase={useCase}
      backHref="/studio"
      backLabel="Back to Studio"
      badge={
        <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
          <Radio className="h-4 w-4" />
          Acquisition Intelligence
        </div>
      }
      title="One trustworthy Person timeline"
      description="Ingest WhatsApp and Meta activity, resolve identity, and keep institutional memory without becoming another CRM."
      primaryAction={
        <>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => void ensureMetaSource()}
            disabled={connecting}
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
            {metaSource ? 'Re-sync Meta source' : 'Connect Meta WhatsApp'}
          </button>
        </>
      }
      secondaryPanelTitle="Sources → People → Timeline"
      secondaryPanelBody="Meta webhooks hit the Railway backend. Redis/BullMQ normalizes events into the Person timeline."
      secondaryPanelContent={
        <div className="space-y-2 text-sm text-slate-300">
          <div>People: {overview?.people ?? '—'}</div>
          <div>Events: {overview?.events ?? '—'}</div>
          <div>Interactions: {overview?.interactions ?? '—'}</div>
          <div>Sources: {overview?.sources?.length ?? 0}</div>
        </div>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Sources</h2>
              <p className="mt-1 text-sm text-slate-600">Webhook health for connected acquisition surfaces.</p>
            </div>
            <Activity className="h-5 w-5 text-slate-400" />
          </div>

          <div className="mt-5 space-y-3">
            {(overview?.sources || []).length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                No sources yet. Connect Meta WhatsApp (reuses atrisi-meta-service).
              </div>
            ) : (
              (overview?.sources || []).map((source) => (
                <div key={source.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-slate-900">{source.name}</div>
                      <div className="mt-1 text-xs uppercase tracking-wide text-slate-500">{source.provider}</div>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        source.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700'
                          : source.status === 'error'
                            ? 'bg-rose-50 text-rose-700'
                            : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {source.status}
                    </span>
                  </div>
                  <div className="mt-3 space-y-1 text-sm text-slate-600">
                    <div>Account: {source.externalAccountId || '—'}</div>
                    <div>Last success: {formatWhen(source.lastSuccessAt)}</div>
                    <div>Last error: {source.lastErrorMessage || formatWhen(source.lastErrorAt)}</div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-8">
            <h3 className="text-lg font-semibold text-slate-900">Recent events</h3>
            <div className="mt-3 space-y-2">
              {events.length === 0 ? (
                <div className="text-sm text-slate-500">No events ingested yet.</div>
              ) : (
                events.slice(0, 8).map((event) => (
                  <div key={event.id} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
                    <div className="font-medium text-slate-800">{event.eventType}</div>
                    <div className="text-xs text-slate-500">{formatWhen(event.occurredAt)}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">People</h2>
              <p className="mt-1 text-sm text-slate-600">Canonical persons resolved from WhatsApp identities.</p>
            </div>
            <Users className="h-5 w-5 text-slate-400" />
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              {people.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  People will appear after the first inbound WhatsApp message is forwarded.
                </div>
              ) : (
                people.map((person) => (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => navigate(`/studio/acquisition/${person.id}`)}
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                      personId === person.id
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="font-medium">{person.displayName || person.primaryPhone || 'Unknown person'}</div>
                    <div className={`mt-1 text-xs ${personId === person.id ? 'text-slate-300' : 'text-slate-500'}`}>
                      {person.primaryPhone || person.primaryEmail || person.status}
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              {!personId ? (
                <div className="text-sm text-slate-600">Select a person to open their interaction timeline.</div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Timeline</div>
                      <h3 className="mt-1 text-lg font-semibold text-slate-900">
                        {selectedPerson?.displayName || selectedPerson?.primaryPhone || 'Person'}
                      </h3>
                    </div>
                    <MessageSquare className="h-5 w-5 text-slate-400" />
                  </div>
                  <div className="mt-4 space-y-3">
                    {timeline.length === 0 ? (
                      <div className="text-sm text-slate-500">No interactions yet.</div>
                    ) : (
                      timeline.map((item) => (
                        <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-sm font-medium text-slate-900">{item.kind}</div>
                            <div className="text-xs text-slate-500">{item.direction || '—'}</div>
                          </div>
                          <p className="mt-1 text-sm text-slate-600">{item.summary || '—'}</p>
                          <div className="mt-2 text-xs text-slate-400">{formatWhen(item.occurredAt)}</div>
                        </div>
                      ))
                    )}
                  </div>
                  <Link
                    to="/studio/acquisition"
                    className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-slate-700 hover:text-slate-900"
                  >
                    Clear selection <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </>
              )}
            </div>
          </div>
        </section>
      </div>
    </UseCaseHomeShell>
  );
}
