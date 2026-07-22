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
  Channel,
  Connector,
  Interaction,
  SourceConnection,
  Timeline,
  TimelineEntry,
} from '@joallm/shared';
import { UseCaseHomeShell } from '../components/use-cases/UseCaseHomeShell';
import { getUseCaseById } from '../constants/useCases';
import { apiClient } from '../utils/api-client';
import { showError, showSuccess } from '../utils/toast';

interface MetaConnectionHealth {
  boundToUser: boolean;
  sourceStatus: string | null;
  channelStatus: string | null;
  connectorStatus: string | null;
  tokenConfigured: boolean;
  phoneNumberIdConfigured: boolean;
  verifyTokenConfigured: boolean;
  phoneNumberId: string | null;
  displayPhoneNumber: string | null;
  verifiedName: string | null;
  qualityRating: string | null;
  graphOk: boolean;
  graphError: string | null;
  webhookPath: string;
  lastWebhookSuccessAt: string | null;
  lastWebhookErrorAt: string | null;
  lastWebhookError: string | null;
  inboundEvents: number;
  people: number;
}

interface PageConnectionHealth {
  boundToUser: boolean;
  facebookSourceStatus: string | null;
  instagramSourceStatus: string | null;
  connectorStatus: string | null;
  tokenConfigured: boolean;
  pageIdConfigured: boolean;
  verifyTokenConfigured: boolean;
  pageId: string | null;
  pageName: string | null;
  igAccountId: string | null;
  igUsername: string | null;
  graphOk: boolean;
  graphError: string | null;
  webhookPath: string;
  lastWebhookSuccessAt: string | null;
  lastWebhookErrorAt: string | null;
  lastWebhookError: string | null;
  inboundEvents: number;
  people: number;
}

interface MarketingLifecycleStep {
  id: string;
  label: string;
  status: 'ready' | 'live' | 'setup' | 'partial';
}

interface MarketingDeveloperSetupStep {
  id: string;
  label: string;
  detail: string;
  done: boolean;
}

interface MarketingHealth {
  boundToUser: boolean;
  leadSourceStatus: string | null;
  adsSourceStatus: string | null;
  tokenConfigured: boolean;
  adAccountConfigured: boolean;
  pageIdConfigured: boolean;
  pixelConfigured?: boolean;
  defaultAdsetConfigured?: boolean;
  websiteConfigured?: boolean;
  adAccountId: string | null;
  adAccountName: string | null;
  currency: string | null;
  graphOk: boolean;
  graphError: string | null;
  webhookPath: string;
  webhookField: string;
  lastLeadSuccessAt: string | null;
  lastLeadError: string | null;
  leadsIngested: number;
  lastInsights: {
    datePreset?: string;
    impressions?: number;
    clicks?: number;
    spend?: number;
    cpc?: number | null;
    ctr?: number | null;
    reach?: number | null;
    currency?: string | null;
    fetchedAt?: string;
  } | null;
  lastCapi?: {
    ok?: boolean;
    eventsReceived?: number;
    error?: string;
    at?: string;
    leadId?: string;
  } | null;
  developerSetup?: MarketingDeveloperSetupStep[];
  lifecycle: MarketingLifecycleStep[];
}

interface OverviewData {
  people: number;
  events: number;
  interactions: number;
  sources: SourceConnection[];
  channels?: Channel[];
  connectors?: Connector[];
  metaHealth?: MetaConnectionHealth;
  pageHealth?: PageConnectionHealth;
  marketingHealth?: MarketingHealth;
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
  if (kind === 'interaction' || kind === 'communication') return 'border-l-teal-500';
  if (kind === 'artifact') return 'border-l-amber-500';
  if (kind === 'decision' || kind === 'learning') return 'border-l-violet-500';
  if (kind === 'event') return 'border-l-sky-500';
  return 'border-l-slate-400';
}

function formatMaturity(value?: string | null) {
  if (!value || value === 'unknown') return null;
  return value.replace(/_/g, ' ');
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
  const [connectingPage, setConnectingPage] = useState(false);
  const [connectingMarketing, setConnectingMarketing] = useState(false);
  const [syncingInsights, setSyncingInsights] = useState(false);

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
  const whatsappChannel = useMemo(
    () => overview?.channels?.find((channel) => channel.kind === 'whatsapp'),
    [overview],
  );
  const facebookChannel = useMemo(
    () => overview?.channels?.find((channel) => channel.kind === 'facebook_organic'),
    [overview],
  );
  const instagramChannel = useMemo(
    () => overview?.channels?.find((channel) => channel.kind === 'instagram_organic'),
    [overview],
  );
  const pageBound = useMemo(
    () =>
      Boolean(
        facebookChannel ||
          instagramChannel ||
          overview?.sources?.some(
            (s) => s.provider === 'meta_facebook_page' || s.provider === 'meta_instagram',
          ),
      ),
    [facebookChannel, instagramChannel, overview?.sources],
  );
  const health = overview?.metaHealth;
  const pageHealth = overview?.pageHealth;
  const marketingHealth = overview?.marketingHealth;

  const ensureMetaSource = async () => {
    setConnecting(true);
    try {
      await apiClient.post('/api/studio/channels/whatsapp', {});
      showSuccess('WhatsApp bound — live Meta probe runs on refresh');
      await load();
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to connect WhatsApp channel');
    } finally {
      setConnecting(false);
    }
  };

  const ensureMetaPage = async () => {
    setConnectingPage(true);
    try {
      await apiClient.post('/api/studio/channels/meta-page', {});
      showSuccess('Facebook + Instagram bound — live Page probe runs on refresh');
      await load();
    } catch (error) {
      showError(
        error instanceof Error ? error.message : 'Failed to connect Facebook + Instagram',
      );
    } finally {
      setConnectingPage(false);
    }
  };

  const ensureMetaMarketing = async () => {
    setConnectingMarketing(true);
    try {
      await apiClient.post('/api/studio/channels/meta-marketing', {});
      showSuccess('Meta Ads + Lead Ads sources bound');
      await load();
    } catch (error) {
      showError(
        error instanceof Error ? error.message : 'Failed to connect Meta Marketing',
      );
    } finally {
      setConnectingMarketing(false);
    }
  };

  const syncInsights = async () => {
    setSyncingInsights(true);
    try {
      await apiClient.post('/api/acquisition/marketing/sync-insights', {
        datePreset: 'last_7d',
      });
      showSuccess('Meta ad insights synced (last 7 days)');
      await load();
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to sync insights');
    } finally {
      setSyncingInsights(false);
    }
  };

  const setupSteps = [
    {
      n: '1',
      title: 'Bound to your JoaLLM account',
      body: 'Studio channel/source row exists for your logged-in user.',
      done: Boolean(health?.boundToUser ?? (whatsappChannel || metaSource)),
    },
    {
      n: '2',
      title: 'Backend env configured',
      body: 'META_ACCESS_TOKEN + META_PHONE_NUMBER_ID present on Railway backend.',
      done: Boolean(health?.tokenConfigured && health?.phoneNumberIdConfigured),
    },
    {
      n: '3',
      title: 'Meta Graph reachable',
      body: health?.graphError
        ? `Live probe failed: ${health.graphError}`
        : 'Token can read this WhatsApp phone number from Meta.',
      done: Boolean(health?.graphOk),
    },
    {
      n: '4',
      title: 'Inbound webhook traffic',
      body: 'At least one WhatsApp event ingested after Meta webhook fires.',
      done: (health?.inboundEvents ?? 0) > 0,
    },
  ];

  const pageSetupSteps = [
    {
      n: '1',
      title: 'Bound to your JoaLLM account',
      body: 'Facebook / Instagram channels + sources exist for your user.',
      done: Boolean(pageHealth?.boundToUser ?? pageBound),
    },
    {
      n: '2',
      title: 'Backend env configured',
      body: 'META_ACCESS_TOKEN + META_PAGE_ID present on Railway backend.',
      done: Boolean(pageHealth?.tokenConfigured && pageHealth?.pageIdConfigured),
    },
    {
      n: '3',
      title: 'Meta Page Graph reachable',
      body: pageHealth?.graphError
        ? `Live probe failed: ${pageHealth.graphError}`
        : 'Token can read this Facebook Page (and linked IG) from Meta.',
      done: Boolean(pageHealth?.graphOk),
    },
    {
      n: '4',
      title: 'Inbound Messenger / IG traffic',
      body: 'At least one Facebook or Instagram DM ingested after Page webhook fires.',
      done: (pageHealth?.inboundEvents ?? 0) > 0,
    },
  ];

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
      title="One trustworthy Person Timeline"
      description="Connect Channels via Platform Connectors, resolve identity, and keep institutional memory — without becoming another CRM."
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
            disabled={connecting || connectingPage || connectingMarketing}
            className="btn-atrisi-primary inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm disabled:cursor-not-allowed"
          >
            {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
            {whatsappChannel || metaSource ? 'Re-bind WhatsApp' : 'Connect WhatsApp'}
          </button>
          <button
            type="button"
            onClick={() => void ensureMetaPage()}
            disabled={connecting || connectingPage || connectingMarketing}
            className="inline-flex items-center gap-2 rounded-full border border-teal-300 bg-white px-4 py-2 text-sm font-medium text-teal-900 hover:bg-teal-50 disabled:cursor-not-allowed"
          >
            {connectingPage ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Link2 className="h-4 w-4" />
            )}
            {pageBound ? 'Re-bind Facebook + Instagram' : 'Connect Facebook + Instagram'}
          </button>
          <button
            type="button"
            onClick={() => void ensureMetaMarketing()}
            disabled={connecting || connectingPage || connectingMarketing}
            className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed"
          >
            {connectingMarketing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Link2 className="h-4 w-4" />
            )}
            {marketingHealth?.boundToUser ? 'Re-bind Meta Marketing' : 'Connect Meta Marketing'}
          </button>
        </>
      }
      secondaryPanelTitle="Channel → Connector → Timeline"
      secondaryPanelBody="Studio owns the business Channel. Platform owns the Connector. Events land on the Person Timeline."
      secondaryPanelContent={
        <div className="grid grid-cols-2 gap-3 text-sm">
          {[
            ['People', overview?.people],
            ['Events', overview?.events],
            ['Channels', overview?.channels?.length ?? 0],
            ['Connectors', overview?.connectors?.length ?? 0],
          ].map(([label, value]) => (
            <div
              key={String(label)}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2"
            >
              <div className="text-xs uppercase tracking-wide text-teal-200/80">{label}</div>
              <div className="mt-1 text-lg font-semibold text-white">{loading ? '…' : (value ?? '—')}</div>
            </div>
          ))}
        </div>
      }
    >
      <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">WhatsApp connection health</h2>
            <p className="mt-1 text-sm text-slate-600">
              Live Graph probe for phone number ID — not just an optimistic “connected” flag.
            </p>
          </div>
          {health && (
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                health.graphOk && health.boundToUser
                  ? 'bg-teal-50 text-teal-800 ring-1 ring-teal-200'
                  : health.boundToUser
                    ? 'bg-amber-50 text-amber-900 ring-1 ring-amber-200'
                    : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200'
              }`}
            >
              {health.graphOk && health.boundToUser
                ? 'Graph OK · bound'
                : health.boundToUser
                  ? 'Bound · Graph not OK'
                  : 'Not bound yet'}
            </span>
          )}
        </div>

        {health ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ['Bound to your account', health.boundToUser ? 'Yes' : 'No'],
              ['Access token on backend', health.tokenConfigured ? 'Yes' : 'Missing'],
              ['Phone number ID on backend', health.phoneNumberIdConfigured ? 'Yes' : 'Missing'],
              ['Verify token set', health.verifyTokenConfigured ? 'Yes' : 'Missing'],
              ['Meta Graph probe', health.graphOk ? 'OK' : health.graphError || 'Failed'],
              [
                'WhatsApp number',
                health.displayPhoneNumber || health.phoneNumberId || '—',
              ],
              ['Verified name', health.verifiedName || '—'],
              ['Webhook path', health.webhookPath],
              ['Last webhook success', formatWhen(health.lastWebhookSuccessAt)],
              ['Inbound events', String(health.inboundEvents)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {label}
                </div>
                <div className="mt-1 break-all text-sm font-medium text-slate-900">{value}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">
            {loading ? 'Probing Meta…' : 'Refresh to run a live Meta health check.'}
          </p>
        )}

        {health?.graphError && !health.graphOk && (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
            Graph error: {health.graphError}. Connector badges may look connected from an older
            click — trust this probe instead.
          </p>
        )}

        <h3 className="mt-6 text-sm font-semibold text-slate-950">Setup checklist</h3>
        <p className="mt-1 text-sm text-slate-600">
          Connect binds ownership. Env + Graph + a real inbound message prove the pipe is live.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {setupSteps.map((step) => (
            <div
              key={step.n}
              className={`rounded-2xl border p-4 ${
                step.done
                  ? 'border-teal-200 bg-teal-50/70'
                  : 'border-slate-200 bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Step {step.n}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                    step.done
                      ? 'bg-teal-100 text-teal-800'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {step.done ? 'True' : 'False'}
                </span>
              </div>
              <div className="mt-2 font-medium text-slate-950">{step.title}</div>
              <p className="mt-1 text-xs leading-5 text-slate-600">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">
              Facebook + Instagram connection health
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Page ID based — no WhatsApp phone number required. Webhook:{' '}
              <code className="text-[11px]">/api/meta/page/webhook</code>
            </p>
          </div>
          {pageHealth && (
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                pageHealth.graphOk && pageHealth.boundToUser
                  ? 'bg-teal-50 text-teal-800 ring-1 ring-teal-200'
                  : pageHealth.boundToUser
                    ? 'bg-amber-50 text-amber-900 ring-1 ring-amber-200'
                    : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200'
              }`}
            >
              {pageHealth.graphOk && pageHealth.boundToUser
                ? 'Graph OK · bound'
                : pageHealth.boundToUser
                  ? 'Bound · Graph not OK'
                  : 'Not bound yet'}
            </span>
          )}
        </div>

        {pageHealth ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ['Bound to your account', pageHealth.boundToUser ? 'Yes' : 'No'],
              ['Access token on backend', pageHealth.tokenConfigured ? 'Yes' : 'Missing'],
              ['Page ID on backend', pageHealth.pageIdConfigured ? 'Yes' : 'Missing'],
              ['Verify token set', pageHealth.verifyTokenConfigured ? 'Yes' : 'Missing'],
              [
                'Meta Page Graph probe',
                pageHealth.graphOk ? 'OK' : pageHealth.graphError || 'Failed',
              ],
              ['Page', pageHealth.pageName || pageHealth.pageId || '—'],
              [
                'Instagram',
                pageHealth.igUsername
                  ? `@${pageHealth.igUsername}`
                  : pageHealth.igAccountId || '—',
              ],
              ['Webhook path', pageHealth.webhookPath],
              ['Last webhook success', formatWhen(pageHealth.lastWebhookSuccessAt)],
              ['Inbound FB/IG events', String(pageHealth.inboundEvents)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {label}
                </div>
                <div className="mt-1 break-all text-sm font-medium text-slate-900">{value}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">
            {loading
              ? 'Probing Meta Page…'
              : 'Refresh after Connect Facebook + Instagram to run a live Page probe.'}
          </p>
        )}

        {pageHealth?.graphError && !pageHealth.graphOk && (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
            Page Graph error: {pageHealth.graphError}. Set META_PAGE_ID and a token with Page
            permissions, then re-bind.
          </p>
        )}

        <h3 className="mt-6 text-sm font-semibold text-slate-950">Setup checklist</h3>
        <p className="mt-1 text-sm text-slate-600">
          Point Meta Page webhooks at the path above, then DM the Page or IG account.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {pageSetupSteps.map((step) => (
            <div
              key={`page-${step.n}`}
              className={`rounded-2xl border p-4 ${
                step.done
                  ? 'border-teal-200 bg-teal-50/70'
                  : 'border-slate-200 bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Step {step.n}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                    step.done
                      ? 'bg-teal-100 text-teal-800'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {step.done ? 'True' : 'False'}
                </span>
              </div>
              <div className="mt-2 font-medium text-slate-950">{step.title}</div>
              <p className="mt-1 text-xs leading-5 text-slate-600">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">
              Meta marketing lifecycle
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Lead Ads ingest + ad account insights. Subscribe Page webhook field{' '}
              <code className="text-[11px]">leadgen</code> on{' '}
              <code className="text-[11px]">/api/meta/page/webhook</code>.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {marketingHealth && (
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  marketingHealth.graphOk && marketingHealth.boundToUser
                    ? 'bg-teal-50 text-teal-800 ring-1 ring-teal-200'
                    : marketingHealth.boundToUser
                      ? 'bg-amber-50 text-amber-900 ring-1 ring-amber-200'
                      : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200'
                }`}
              >
                {marketingHealth.graphOk && marketingHealth.boundToUser
                  ? 'Ads Graph OK · bound'
                  : marketingHealth.boundToUser
                    ? 'Bound · Ads Graph not OK'
                    : 'Not bound yet'}
              </span>
            )}
            <button
              type="button"
              onClick={() => void syncInsights()}
              disabled={syncingInsights || connectingMarketing}
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed"
            >
              {syncingInsights ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Activity className="h-3.5 w-3.5" />
              )}
              Sync insights (7d)
            </button>
          </div>
        </div>

        {marketingHealth?.lifecycle && marketingHealth.lifecycle.length > 0 && (
          <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {marketingHealth.lifecycle.map((step) => (
              <div
                key={step.id}
                className={`rounded-2xl border px-3 py-3 ${
                  step.status === 'live'
                    ? 'border-teal-200 bg-teal-50/70'
                    : step.status === 'ready' || step.status === 'partial'
                      ? 'border-amber-200 bg-amber-50/50'
                      : 'border-slate-200 bg-slate-50'
                }`}
              >
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  {step.status}
                </div>
                <div className="mt-1 text-sm font-medium text-slate-950">{step.label}</div>
              </div>
            ))}
          </div>
        )}

        {marketingHealth ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ['Bound to your account', marketingHealth.boundToUser ? 'Yes' : 'No'],
              ['Access token on backend', marketingHealth.tokenConfigured ? 'Yes' : 'Missing'],
              ['Ad account configured', marketingHealth.adAccountConfigured ? 'Yes' : 'Missing'],
              ['Page ID (for Lead Ads)', marketingHealth.pageIdConfigured ? 'Yes' : 'Missing'],
              [
                'Default ad set',
                marketingHealth.defaultAdsetConfigured ? 'Set' : 'Optional — creative only',
              ],
              [
                'Pixel / CAPI',
                marketingHealth.pixelConfigured ? 'Configured' : 'Missing META_PIXEL_ID',
              ],
              [
                'Ad account Graph probe',
                marketingHealth.graphOk ? 'OK' : marketingHealth.graphError || 'Failed',
              ],
              [
                'Ad account',
                marketingHealth.adAccountName || marketingHealth.adAccountId || '—',
              ],
              ['Currency', marketingHealth.currency || '—'],
              ['Leads ingested', String(marketingHealth.leadsIngested)],
              ['Last lead success', formatWhen(marketingHealth.lastLeadSuccessAt)],
              [
                'Last CAPI',
                marketingHealth.lastCapi?.at
                  ? `${marketingHealth.lastCapi.ok ? 'OK' : 'Error'} · ${formatWhen(marketingHealth.lastCapi.at)}`
                  : '—',
              ],
              [
                'Insights (7d impressions)',
                marketingHealth.lastInsights?.impressions != null
                  ? String(marketingHealth.lastInsights.impressions)
                  : '—',
              ],
              [
                'Insights spend',
                marketingHealth.lastInsights?.spend != null
                  ? `${marketingHealth.lastInsights.spend}${
                      marketingHealth.lastInsights.currency
                        ? ` ${marketingHealth.lastInsights.currency}`
                        : ''
                    }`
                  : '—',
              ],
              [
                'Insights fetched',
                formatWhen(
                  typeof marketingHealth.lastInsights?.fetchedAt === 'string'
                    ? marketingHealth.lastInsights.fetchedAt
                    : null,
                ),
              ],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {label}
                </div>
                <div className="mt-1 break-all text-sm font-medium text-slate-900">{value}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">
            {loading
              ? 'Loading marketing health…'
              : 'Connect Meta Marketing, set META_AD_ACCOUNT_ID, then Sync insights.'}
          </p>
        )}

        {marketingHealth?.graphError && !marketingHealth.graphOk && (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
            Ads Graph error: {marketingHealth.graphError}. Use a long-lived token with ads_read
            (and leads_retrieval for Lead Ads), set META_AD_ACCOUNT_ID, then re-bind.
          </p>
        )}
      </section>

      <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">
            Meta developer account checklist
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Do these in Meta Business / Developers, then mirror the IDs into Railway env vars and
            redeploy.
          </p>
        </div>

        {marketingHealth?.developerSetup && marketingHealth.developerSetup.length > 0 && (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {marketingHealth.developerSetup.map((step) => (
              <div
                key={step.id}
                className={`rounded-2xl border p-4 ${
                  step.done
                    ? 'border-teal-200 bg-teal-50/70'
                    : 'border-slate-200 bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {step.id}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                      step.done
                        ? 'bg-teal-100 text-teal-800'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {step.done ? 'Done' : 'Todo'}
                  </span>
                </div>
                <div className="mt-2 font-medium text-slate-950">{step.label}</div>
                <p className="mt-1 text-xs leading-5 text-slate-600">{step.detail}</p>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 space-y-4 text-sm text-slate-700">
          <div>
            <div className="font-semibold text-slate-950">1. App + Business assets</div>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-xs leading-5 text-slate-600">
              <li>
                developers.facebook.com → your App → add products: WhatsApp, Messenger, Instagram,
                Webhooks, Marketing API.
              </li>
              <li>
                Business Settings → link Page, WhatsApp Business Account, Ad Account, and (optional)
                Pixel / dataset to the same Business.
              </li>
            </ul>
          </div>
          <div>
            <div className="font-semibold text-slate-950">2. Permissions + long-lived token</div>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-xs leading-5 text-slate-600">
              <li>
                Create a System User in Business Settings → generate token with:{' '}
                <code className="text-[11px]">
                  ads_management, ads_read, leads_retrieval, pages_show_list, pages_manage_metadata,
                  pages_messaging, pages_read_engagement, business_management, whatsapp_business_messaging
                </code>
                .
              </li>
              <li>
                Assign the System User to your Page, Ad Account, and WhatsApp assets. Paste token into
                Railway <code className="text-[11px]">META_ACCESS_TOKEN</code>.
              </li>
            </ul>
          </div>
          <div>
            <div className="font-semibold text-slate-950">3. Webhooks</div>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-xs leading-5 text-slate-600">
              <li>
                WhatsApp callback:{' '}
                <code className="text-[11px]">
                  https://joallm-marketing-backend-production.up.railway.app/api/meta/webhook
                </code>{' '}
                — subscribe <code className="text-[11px]">messages</code>.
              </li>
              <li>
                Page / IG / Lead Ads:{' '}
                <code className="text-[11px]">
                  https://joallm-marketing-backend-production.up.railway.app/api/meta/page/webhook
                </code>{' '}
                — subscribe <code className="text-[11px]">messages</code> and{' '}
                <code className="text-[11px]">leadgen</code>. Verify token:{' '}
                <code className="text-[11px]">atrisi_meta_webhook_verify</code> (or your{' '}
                <code className="text-[11px]">META_VERIFY_TOKEN</code>).
              </li>
            </ul>
          </div>
          <div>
            <div className="font-semibold text-slate-950">4. Railway env vars</div>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-xs leading-5 text-slate-600">
              <li>
                Required now: <code className="text-[11px]">META_ACCESS_TOKEN</code>,{' '}
                <code className="text-[11px]">META_PHONE_NUMBER_ID</code>,{' '}
                <code className="text-[11px]">META_PAGE_ID</code>,{' '}
                <code className="text-[11px]">META_AD_ACCOUNT_ID</code>,{' '}
                <code className="text-[11px]">META_VERIFY_TOKEN</code>
              </li>
              <li>
                For PAUSED ads from Assets: <code className="text-[11px]">META_DEFAULT_ADSET_ID</code>{' '}
                (create a paused ad set once in Ads Manager)
              </li>
              <li>
                For CAPI on Lead Ads: <code className="text-[11px]">META_PIXEL_ID</code> (+ optional{' '}
                <code className="text-[11px]">META_CAPI_ACCESS_TOKEN</code>,{' '}
                <code className="text-[11px]">META_WEBSITE_URL</code>)
              </li>
            </ul>
          </div>
          <div>
            <div className="font-semibold text-slate-950">5. After redeploy</div>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-xs leading-5 text-slate-600">
              <li>
                Acquisition Intelligence → Connect WhatsApp, Facebook + Instagram, Meta Marketing.
              </li>
              <li>Sync insights → submit a test Lead Ad → confirm person + CAPI row updates.</li>
              <li>
                Workspace → Assets → Publish to Meta Ads (creates creative / PAUSED ad) or Facebook
                organic (Page photo).
              </li>
            </ul>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">Channels & connectors</h2>
              <p className="mt-1 text-sm text-slate-600">
                Business Channels bind to Platform Connectors — Studio never calls Meta directly.
              </p>
            </div>
            <Activity className="h-5 w-5 text-teal-600" />
          </div>

          <div className="mt-5 space-y-3">
            {(overview?.channels || []).length === 0 && (overview?.sources || []).length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                No channels yet. Use <span className="font-medium">Connect WhatsApp to my account</span> to
                bind ownership, then check Live Meta connection health above.
              </div>
            ) : (
              <>
                {(overview?.channels || []).map((channel) => (
                  <div
                    key={channel.id}
                    className="rounded-2xl border border-slate-200 border-l-4 border-l-teal-500 bg-white p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-teal-700">Channel</div>
                        <div className="mt-1 font-medium text-slate-950">{channel.name}</div>
                        <div className="mt-1 text-xs uppercase tracking-wide text-slate-500">{channel.kind}</div>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${sourceStatusClass(channel.status === 'active' ? 'active' : 'paused')}`}>
                        {channel.status}
                      </span>
                    </div>
                    <div className="mt-3 text-sm text-slate-600">
                      Connector: {channel.connectorProvider || '—'}
                    </div>
                  </div>
                ))}
                {(overview?.connectors || []).map((connector) => (
                  <div
                    key={connector.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Platform connector</div>
                        <div className="mt-1 font-medium text-slate-950">{connector.name}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {connector.provider}
                          {connector.apiVersion ? ` · ${connector.apiVersion}` : ''}
                        </div>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${sourceStatusClass(connector.status === 'connected' ? 'active' : connector.status === 'error' ? 'error' : 'paused')}`}>
                        {connector.status}
                      </span>
                    </div>
                    {connector.lastErrorMessage && (
                      <div className="mt-2 text-xs text-rose-700">{connector.lastErrorMessage}</div>
                    )}
                  </div>
                ))}
                {(overview?.sources || []).map((source) => (
                  <div
                    key={source.id}
                    className={`rounded-2xl border border-slate-200 bg-white p-4 ${
                      source.status === 'error' ? 'border-l-4 border-l-amber-500' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Acquisition source</div>
                        <div className="mt-1 font-medium text-slate-950">{source.name}</div>
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
                ))}
              </>
            )}
          </div>

          <div className="mt-8">
            <h3 className="text-lg font-semibold text-slate-950">Recent events</h3>
            <div className="mt-3 space-y-2">
              {events.length === 0 ? (
                <div className="text-sm text-slate-500">
                  No events ingested yet. After Meta webhooks fire, Acquisition Events show here.
                </div>
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
              <p className="mt-1 text-sm text-slate-600">
                Canonical persons resolved from WhatsApp, Facebook, and Instagram identities.
              </p>
            </div>
            <Users className="h-5 w-5 text-teal-600" />
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              {people.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  People appear after the first inbound WhatsApp message is forwarded to ATRISI.
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
                          ? 'border-teal-500 bg-teal-50 shadow-sm ring-1 ring-teal-200'
                          : 'border-slate-200 bg-white hover:border-teal-300 hover:bg-teal-50/30'
                      }`}
                    >
                      <div className="font-medium text-slate-950">
                        {person.displayName || person.primaryPhone || 'Unknown person'}
                      </div>
                      <div className={`mt-1 text-xs ${selected ? 'text-teal-800' : 'text-slate-500'}`}>
                        {formatMaturity(person.relationshipMaturity) ||
                          person.primaryPhone ||
                          person.primaryEmail ||
                          person.status}
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
                        Timeline Service · events, interactions
                        {timelineEntries.some((e) => e.kind === 'artifact') ? ', artifacts' : ''}
                      </p>
                      {formatMaturity(selectedPerson?.relationshipMaturity) && (
                        <div className="mt-2 inline-flex rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-medium capitalize text-teal-800 ring-1 ring-teal-200/80">
                          {formatMaturity(selectedPerson?.relationshipMaturity)}
                        </div>
                      )}
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
                            <div className="text-sm font-medium capitalize text-slate-950">{item.kind}</div>
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
