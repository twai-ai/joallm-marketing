import { useCallback, useEffect, useMemo, useState } from 'react';
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
import type {
  AcquisitionEvent,
  AcquisitionPerson,
  Interaction,
  SourceConnection,
  Timeline,
  TimelineEntry,
} from '@joallm/shared';
import { UseCaseHomeShell } from '../components/use-cases/UseCaseHomeShell';
import { getUseCaseById } from '../constants/useCases';
import { apiClient } from '../utils/api-client';
import { showError, showSuccess } from '../utils/toast';

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

function sourceStatusClass(status: string) {
  if (status === 'active') return 'bg-teal-50 text-teal-800 ring-1 ring-teal-200/80';
  if (status === 'error') return 'bg-rose-50 text-rose-700 ring-1 ring-rose-200/80';
  if (status === 'paused') return 'bg-amber-50 text-amber-800 ring-1 ring-amber-200/80';
  return 'bg-slate-100 text-slate-600 ring-1 ring-slate-200/80';
}

function entryKindClass(kind: TimelineEntry['kind']) {
  if (kind === 'interaction') return 'border-l-teal-500';
  if (kind === 'event') return 'border-l-sky-500';
  return 'border-l-slate-400';
}

export function AcquisitionIntelligencePage() {
  const useCase = getUseCaseById('acquisition');
  const navigate = useNavigate();
  const { personId } = useParams<{ personId?: string }>();

  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [people, setPeople] = useState<AcquisitionPerson[]>([]);
  const [events, setEvents] = useState<AcquisitionEvent[]>([]);
  const [timelineEntries, setTimelineEntries] = useState<TimelineEntry[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<AcquisitionPerson | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [overviewRes, peopleRes, eventsRes] = await Promise.all([
        apiClient.get<{ success: boolean; data: OverviewData }>('/api/acquisition/overview'),
        apiClient.get<{ success: boolean; data: AcquisitionPerson[] }>('/api/acquisition/people'),
        apiClient.get<{ success: boolean; data: AcquisitionEvent[] }>('/api/acquisition/events?limit=30'),
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
        data: {
          person: AcquisitionPerson;
          timeline: Timeline;
          interactions: Interaction[];
          entries?: TimelineEntry[];
        };
      }>(`/api/acquisition/people/${id}/timeline`);
      setSelectedPerson(res.data.person);
      const entries =
        res.data.timeline?.entries ||
        res.data.entries ||
        (res.data.interactions || []).map((item) => ({
          id: `interaction:${item.id}`,
          kind: 'interaction' as const,
          occurredAt: item.occurredAt,
          summary: item.summary,
          refId: item.id,
          attributes: { kind: item.kind, direction: item.direction },
        }));
      setTimelineEntries(entries);
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
      setTimelineEntries([]);
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
      brand="institutional"
      useCase={useCase}
      backHref="/studio"
      backLabel="Back to Studio"
      badge={
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-sm font-medium text-teal-800">
          <Radio className="h-4 w-4 text-teal-600" />
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
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-teal-300 hover:bg-teal-50/40"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => void ensureMetaSource()}
            disabled={connecting}
            className="btn-atrisi-primary inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm disabled:cursor-not-allowed"
          >
            {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
            {metaSource ? 'Re-sync Meta source' : 'Connect Meta WhatsApp'}
          </button>
        </>
      }
      secondaryPanelTitle="Sources → People → Timeline"
      secondaryPanelBody="Meta webhooks hit the Railway backend. Redis/BullMQ normalizes events into the Person timeline."
      secondaryPanelContent={
        <div className="grid grid-cols-2 gap-3 text-sm">
          {[
            ['People', overview?.people],
            ['Events', overview?.events],
            ['Interactions', overview?.interactions],
            ['Sources', overview?.sources?.length ?? 0],
          ].map(([label, value]) => (
            <div
              key={String(label)}
              className="rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2"
            >
              <div className="text-xs uppercase tracking-wide text-teal-200/80">{label}</div>
              <div className="mt-1 text-lg font-semibold text-white">{value ?? '—'}</div>
            </div>
          ))}
        </div>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">Sources</h2>
              <p className="mt-1 text-sm text-slate-600">Webhook health for connected acquisition surfaces.</p>
            </div>
            <Activity className="h-5 w-5 text-teal-600" />
          </div>

          <div className="mt-5 space-y-3">
            {(overview?.sources || []).length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                No sources yet. Connect Meta WhatsApp (reuses atrisi-meta-service).
              </div>
            ) : (
              (overview?.sources || []).map((source) => (
                <div
                  key={source.id}
                  className={`rounded-2xl border border-slate-200 bg-white p-4 ${
                    source.status === 'error' ? 'border-l-4 border-l-amber-500' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-slate-950">{source.name}</div>
                      <div className="mt-1 text-xs uppercase tracking-wide text-slate-500">{source.provider}</div>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${sourceStatusClass(source.status)}`}>
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
            <h3 className="text-lg font-semibold text-slate-950">Recent events</h3>
            <div className="mt-3 space-y-2">
              {events.length === 0 ? (
                <div className="text-sm text-slate-500">No events ingested yet.</div>
              ) : (
                events.slice(0, 8).map((event) => (
                  <div
                    key={event.id}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                  >
                    <div className="font-medium text-slate-800">{event.eventType}</div>
                    <div className="text-xs text-slate-500">{formatWhen(event.occurredAt)}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">People</h2>
              <p className="mt-1 text-sm text-slate-600">Canonical persons resolved from WhatsApp identities.</p>
            </div>
            <Users className="h-5 w-5 text-teal-600" />
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              {people.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  People will appear after the first inbound WhatsApp message is forwarded.
                </div>
              ) : (
                people.map((person) => {
                  const selected = personId === person.id;
                  return (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => navigate(`/studio/acquisition/${person.id}`)}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                        selected
                          ? 'border-teal-500/60 bg-slate-950 text-white shadow-[0_0_24px_rgba(20,184,166,0.18)]'
                          : 'border-slate-200 bg-white hover:border-teal-300 hover:bg-teal-50/30'
                      }`}
                    >
                      <div className="font-medium">
                        {person.displayName || person.primaryPhone || 'Unknown person'}
                      </div>
                      <div className={`mt-1 text-xs ${selected ? 'text-teal-200' : 'text-slate-500'}`}>
                        {person.primaryPhone || person.primaryEmail || person.status}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              {!personId ? (
                <div className="text-sm text-slate-600">Select a person to open their Person Timeline.</div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-teal-700">
                        Person Timeline
                      </div>
                      <h3 className="mt-1 text-lg font-semibold text-slate-950">
                        {selectedPerson?.displayName || selectedPerson?.primaryPhone || 'Person'}
                      </h3>
                      <p className="mt-1 text-xs text-slate-500">
                        Timeline Service · events + interactions
                      </p>
                    </div>
                    <MessageSquare className="h-5 w-5 text-teal-600" />
                  </div>
                  <div className="mt-4 space-y-3">
                    {timelineEntries.length === 0 ? (
                      <div className="text-sm text-slate-500">No timeline entries yet.</div>
                    ) : (
                      timelineEntries.map((item) => (
                        <div
                          key={item.id}
                          className={`rounded-xl border border-slate-200 border-l-4 bg-white p-3 ${entryKindClass(item.kind)}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-sm font-medium text-slate-950 capitalize">{item.kind}</div>
                            <div className="text-xs uppercase tracking-wide text-slate-500">
                              {String(item.attributes?.direction || item.attributes?.eventType || '—')}
                            </div>
                          </div>
                          <p className="mt-1 text-sm text-slate-600">{item.summary || '—'}</p>
                          <div className="mt-2 text-xs text-slate-400">{formatWhen(item.occurredAt)}</div>
                        </div>
                      ))
                    )}
                  </div>
                  <Link
                    to="/studio/acquisition"
                    className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-teal-800 hover:text-teal-950"
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
