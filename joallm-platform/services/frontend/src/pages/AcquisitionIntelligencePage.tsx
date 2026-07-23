import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  ChevronDown,
  Link2,
  Loader2,
  MessageSquare,
  Radio,
  RefreshCw,
  Search,
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
  lifecycle: Array<{ id: string; label: string; status: string }>;
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
  tenant?: {
    organizationId: string;
    organizationCode: string;
    role: string;
    permissions: string[];
    experiences: string[];
  } | null;
}

type WorkspaceTab = 'people' | 'inbox' | 'activity';

type TeamActivityItem = {
  id: string;
  action: string;
  actorName: string | null;
  actorEmail: string | null;
  createdAt: string;
  resource: string | null;
};

function formatWhen(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatMaturity(value?: string | null) {
  if (!value || value === 'unknown') return null;
  return value.replace(/_/g, ' ');
}

function entryKindClass(kind: TimelineEntry['kind']) {
  if (kind === 'interaction' || kind === 'communication') return 'border-l-[#0f766e]';
  if (kind === 'artifact') return 'border-l-amber-600';
  if (kind === 'decision' || kind === 'learning') return 'border-l-sky-700';
  if (kind === 'event') return 'border-l-slate-500';
  return 'border-l-slate-400';
}

function humanAction(action: string) {
  const map: Record<string, string> = {
    'auth.login.succeeded': 'signed in',
    'auth.login.denied': 'sign-in denied',
    'membership.auto_joined': 'joined the institution',
    'integration.meta.bound': 'bound a Meta channel',
    'integration.meta.sync_completed': 'synced Meta insights',
    'publishing.executed': 'published content',
    'campaign.created': 'created a campaign',
    login: 'signed in',
    logout: 'signed out',
  };
  return map[action] || action.replace(/\./g, ' ');
}

function ChannelPill(props: {
  label: string;
  live: boolean;
  detail: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 border-b border-slate-200/80 py-3 last:border-b-0 sm:border-b-0 sm:border-r sm:px-4 sm:py-0 sm:last:border-r-0">
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${
          props.live ? 'bg-[#0f766e]' : 'bg-slate-300'
        }`}
        aria-hidden
      />
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          {props.label}
        </div>
        <div className="truncate text-sm font-medium text-slate-900">
          {props.live ? props.detail : 'Not connected'}
        </div>
      </div>
    </div>
  );
}

export function AcquisitionIntelligencePage() {
  const navigate = useNavigate();
  const { personId } = useParams<{ personId?: string }>();

  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [people, setPeople] = useState<AcquisitionPerson[]>([]);
  const [events, setEvents] = useState<AcquisitionEvent[]>([]);
  const [timelineEntries, setTimelineEntries] = useState<TimelineEntry[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<AcquisitionPerson | null>(null);
  const [teamActivity, setTeamActivity] = useState<TeamActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [connectingPage, setConnectingPage] = useState(false);
  const [connectingMarketing, setConnectingMarketing] = useState(false);
  const [syncingInsights, setSyncingInsights] = useState(false);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<WorkspaceTab>('people');
  const [adminOpen, setAdminOpen] = useState(false);

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

      const canViewActivity =
        overviewRes.data?.tenant?.permissions?.includes('activity.view') ||
        overviewRes.data?.tenant?.role === 'admin' ||
        overviewRes.data?.tenant?.role === 'owner' ||
        overviewRes.data?.tenant?.role === 'member';
      if (canViewActivity) {
        try {
          const activityRes = await apiClient.get<{
            success: boolean;
            data: { items: TeamActivityItem[] };
          }>('/api/operations/activity?limit=20');
          setTeamActivity(activityRes.data?.items || []);
        } catch {
          setTeamActivity([]);
        }
      } else {
        setTeamActivity([]);
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to load Acquisition');
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
      showError(error instanceof Error ? error.message : 'Failed to load timeline');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (personId) {
      setTab('people');
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
  const tenant = overview?.tenant;
  const canManageIntegrations =
    !tenant?.permissions?.length ||
    tenant.permissions.includes('integrations.manage') ||
    tenant.role === 'admin' ||
    tenant.role === 'owner';

  const waLive = Boolean(health?.graphOk && health?.boundToUser);
  const pageLive = Boolean(pageHealth?.graphOk && pageHealth?.boundToUser);
  const adsLive = Boolean(marketingHealth?.graphOk && marketingHealth?.boundToUser);

  const filteredPeople = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return people;
    return people.filter((person) => {
      const hay = [
        person.displayName,
        person.primaryPhone,
        person.primaryEmail,
        person.relationshipMaturity,
        person.status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [people, query]);

  const ensureMetaSource = async () => {
    setConnecting(true);
    try {
      await apiClient.post('/api/studio/channels/whatsapp', {});
      showSuccess('WhatsApp connected');
      await load();
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to connect WhatsApp');
    } finally {
      setConnecting(false);
    }
  };

  const ensureMetaPage = async () => {
    setConnectingPage(true);
    try {
      await apiClient.post('/api/studio/channels/meta-page', {});
      showSuccess('Facebook + Instagram connected');
      await load();
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to connect Page / IG');
    } finally {
      setConnectingPage(false);
    }
  };

  const ensureMetaMarketing = async () => {
    setConnectingMarketing(true);
    try {
      await apiClient.post('/api/studio/channels/meta-marketing', {});
      showSuccess('Meta Marketing connected');
      await load();
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to connect Marketing');
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
      showSuccess('Insights synced (last 7 days)');
      await load();
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to sync insights');
    } finally {
      setSyncingInsights(false);
    }
  };

  const busy = connecting || connectingPage || connectingMarketing || syncingInsights || loading;

  return (
    <div className="atrisi-page relative min-h-full overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 10% -10%, rgba(15,118,110,0.12), transparent 55%), radial-gradient(ellipse 60% 40% at 100% 0%, rgba(15,23,42,0.08), transparent 50%), linear-gradient(180deg, #f8fafc 0%, #eef2f6 100%)',
        }}
        aria-hidden
      />

      <div className="workspace-shell relative flex flex-col gap-8 px-0 py-6 sm:py-8">
        <header className="flex flex-col gap-6 border-b border-slate-200/90 pb-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 max-w-2xl">
              <Link
                to="/studio"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-slate-900"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Studio
              </Link>
              <p className="app-display mt-4 text-xs font-semibold uppercase tracking-[0.22em] text-[#0f766e]">
                {tenant?.organizationCode || 'ATRISI'} · Acquisition
              </p>
              <h1 className="app-display mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                People & conversations
              </h1>
              <p className="mt-2 max-w-xl text-base leading-relaxed text-slate-600">
                Shared institution inbox — WhatsApp, Messenger, Instagram, and Lead Ads resolve to
                one person timeline your team can act on.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {tenant && (
                <span className="rounded-md border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-medium capitalize text-slate-700">
                  {tenant.role}
                </span>
              )}
              <button
                type="button"
                onClick={() => void load()}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                type="button"
                onClick={() => void syncInsights()}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                {syncingInsights ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Activity className="h-4 w-4" />
                )}
                Sync insights
              </button>
            </div>
          </div>

          <div className="grid gap-0 rounded-2xl border border-slate-200/90 bg-white/70 px-4 py-1 backdrop-blur-sm sm:grid-cols-3 sm:px-0 sm:py-4">
            <ChannelPill
              label="WhatsApp"
              live={waLive}
              detail={
                health?.displayPhoneNumber ||
                health?.verifiedName ||
                whatsappChannel?.name ||
                'Connected'
              }
            />
            <ChannelPill
              label="Page / Instagram"
              live={pageLive}
              detail={
                pageHealth?.pageName ||
                (pageHealth?.igUsername ? `@${pageHealth.igUsername}` : null) ||
                'Connected'
              }
            />
            <ChannelPill
              label="Ads & leads"
              live={adsLive}
              detail={
                marketingHealth?.adAccountName ||
                `${marketingHealth?.leadsIngested ?? 0} leads ingested`
              }
            />
          </div>

          <div className="flex flex-wrap gap-6 text-sm text-slate-600">
            <div>
              <span className="font-semibold text-slate-950">{overview?.people ?? '—'}</span> people
            </div>
            <div>
              <span className="font-semibold text-slate-950">{overview?.events ?? '—'}</span> events
            </div>
            <div>
              <span className="font-semibold text-slate-950">{overview?.interactions ?? '—'}</span>{' '}
              interactions
            </div>
            {marketingHealth?.lastInsights?.spend != null && (
              <div>
                <span className="font-semibold text-slate-950">
                  {marketingHealth.lastInsights.currency || 'INR'}{' '}
                  {Number(marketingHealth.lastInsights.spend).toFixed(0)}
                </span>{' '}
                spend (7d)
              </div>
            )}
          </div>
        </header>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-1 rounded-lg border border-slate-200 bg-white/80 p-1">
            {(
              [
                { id: 'people' as const, label: 'People', icon: Users },
                { id: 'inbox' as const, label: 'Inbox', icon: Radio },
                { id: 'activity' as const, label: 'Team', icon: Activity },
              ] as const
            ).map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium transition ${
                    active
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </div>

          {tab === 'people' && (
            <label className="relative block w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search people…"
                className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none ring-[#0f766e]/30 placeholder:text-slate-400 focus:ring-2"
              />
            </label>
          )}
        </div>

        {tab === 'people' && (
          <div className="grid min-h-[28rem] gap-0 overflow-hidden rounded-2xl border border-slate-200/90 bg-white/85 shadow-[0_20px_50px_-28px_rgba(15,23,42,0.35)] lg:grid-cols-[minmax(16rem,22rem)_1fr]">
            <aside className="border-b border-slate-200 lg:border-b-0 lg:border-r">
              <div className="border-b border-slate-100 px-4 py-3">
                <h2 className="text-sm font-semibold text-slate-950">Directory</h2>
                <p className="text-xs text-slate-500">
                  {filteredPeople.length} of {people.length}
                </p>
              </div>
              <div className="max-h-[28rem] overflow-y-auto p-2">
                {loading && people.length === 0 ? (
                  <div className="flex items-center gap-2 px-3 py-8 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading people…
                  </div>
                ) : filteredPeople.length === 0 ? (
                  <div className="px-3 py-10 text-center text-sm text-slate-500">
                    {people.length === 0
                      ? 'No people yet. Inbound WhatsApp, Messenger, or Lead Ads will appear here.'
                      : 'No matches for that search.'}
                  </div>
                ) : (
                  filteredPeople.map((person) => {
                    const selected = personId === person.id;
                    return (
                      <button
                        key={person.id}
                        type="button"
                        onClick={() => navigate(`/studio/acquisition/${person.id}`)}
                        className={`mb-1 w-full rounded-xl px-3 py-3 text-left transition ${
                          selected
                            ? 'bg-slate-900 text-white'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className={`font-medium ${selected ? 'text-white' : 'text-slate-950'}`}>
                          {person.displayName || person.primaryPhone || 'Unknown person'}
                        </div>
                        <div
                          className={`mt-0.5 text-xs capitalize ${
                            selected ? 'text-slate-300' : 'text-slate-500'
                          }`}
                        >
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
            </aside>

            <section className="flex min-h-[28rem] flex-col">
              {!personId ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
                  <MessageSquare className="h-8 w-8 text-slate-300" />
                  <h3 className="app-display text-xl font-semibold text-slate-900">
                    Select a person
                  </h3>
                  <p className="max-w-sm text-sm leading-relaxed text-slate-500">
                    Open anyone in the directory to review their shared timeline — messages, leads,
                    and campaign touchpoints in one place.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0f766e]">
                        Person timeline
                      </p>
                      <h3 className="app-display mt-1 text-2xl font-semibold text-slate-950">
                        {selectedPerson?.displayName ||
                          selectedPerson?.primaryPhone ||
                          'Person'}
                      </h3>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                        {selectedPerson?.primaryPhone && (
                          <span>{selectedPerson.primaryPhone}</span>
                        )}
                        {selectedPerson?.primaryEmail && (
                          <span>{selectedPerson.primaryEmail}</span>
                        )}
                        {formatMaturity(selectedPerson?.relationshipMaturity) && (
                          <span className="rounded-full bg-teal-50 px-2 py-0.5 font-medium capitalize text-teal-900">
                            {formatMaturity(selectedPerson?.relationshipMaturity)}
                          </span>
                        )}
                      </div>
                    </div>
                    <Link
                      to="/studio/acquisition"
                      className="text-sm font-medium text-slate-500 hover:text-slate-900"
                    >
                      Clear
                    </Link>
                  </div>
                  <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
                    {timelineEntries.length === 0 ? (
                      <p className="py-10 text-center text-sm text-slate-500">
                        No timeline entries yet for this person.
                      </p>
                    ) : (
                      timelineEntries.map((item) => (
                        <article
                          key={item.id}
                          className={`border-l-[3px] bg-slate-50/80 px-4 py-3 ${entryKindClass(item.kind)}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              {item.kind}
                            </span>
                            <time className="text-xs text-slate-400">
                              {formatWhen(item.occurredAt)}
                            </time>
                          </div>
                          <p className="mt-1 text-sm leading-relaxed text-slate-800">
                            {item.summary || '—'}
                          </p>
                        </article>
                      ))
                    )}
                  </div>
                </>
              )}
            </section>
          </div>
        )}

        {tab === 'inbox' && (
          <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white/85">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="app-display text-lg font-semibold text-slate-950">Recent events</h2>
              <p className="text-sm text-slate-500">
                Latest inbound signals across WhatsApp, Page, IG, and Lead Ads.
              </p>
            </div>
            <ul className="divide-y divide-slate-100">
              {events.length === 0 ? (
                <li className="px-5 py-12 text-center text-sm text-slate-500">
                  No events yet. Once Meta webhooks deliver traffic, it shows up here.
                </li>
              ) : (
                events.map((event) => (
                  <li
                    key={event.id}
                    className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-3.5"
                  >
                    <div>
                      <div className="text-sm font-medium text-slate-900">{event.eventType}</div>
                      <div className="text-xs text-slate-500">{event.source || 'acquisition'}</div>
                    </div>
                    <time className="text-xs text-slate-400">{formatWhen(event.occurredAt)}</time>
                  </li>
                ))
              )}
            </ul>
          </section>
        )}

        {tab === 'activity' && (
          <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white/85">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="app-display text-lg font-semibold text-slate-950">Team activity</h2>
              <p className="text-sm text-slate-500">
                Who signed in, bound channels, or created campaigns for{' '}
                {tenant?.organizationCode || 'your institution'}.
              </p>
            </div>
            <ul className="divide-y divide-slate-100">
              {teamActivity.length === 0 ? (
                <li className="px-5 py-12 text-center text-sm text-slate-500">
                  No activity recorded yet. Team actions appear here after sign-in and channel work.
                </li>
              ) : (
                teamActivity.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-3.5"
                  >
                    <p className="text-sm text-slate-800">
                      <span className="font-semibold text-slate-950">
                        {item.actorName || item.actorEmail || 'Someone'}
                      </span>{' '}
                      {humanAction(item.action)}
                      {item.resource ? (
                        <span className="text-slate-500"> · {item.resource}</span>
                      ) : null}
                    </p>
                    <time className="text-xs text-slate-400">{formatWhen(item.createdAt)}</time>
                  </li>
                ))
              )}
            </ul>
          </section>
        )}

        <section className="rounded-2xl border border-slate-200/80 bg-white/60">
          <button
            type="button"
            onClick={() => setAdminOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
          >
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Channel administration</h2>
              <p className="text-xs text-slate-500">
                Bind Meta channels and review connector status
                {canManageIntegrations ? '' : ' (view only)'}
              </p>
            </div>
            <ChevronDown
              className={`h-4 w-4 text-slate-500 transition ${adminOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {adminOpen && (
            <div className="space-y-5 border-t border-slate-100 px-5 py-5">
              {canManageIntegrations && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void ensureMetaSource()}
                    disabled={busy}
                    className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60"
                  >
                    {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                    {whatsappChannel || metaSource ? 'Re-bind WhatsApp' : 'Connect WhatsApp'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void ensureMetaPage()}
                    disabled={busy}
                    className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60"
                  >
                    {connectingPage ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Link2 className="h-4 w-4" />
                    )}
                    {pageBound ? 'Re-bind Page / IG' : 'Connect Page / IG'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void ensureMetaMarketing()}
                    disabled={busy}
                    className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60"
                  >
                    {connectingMarketing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Link2 className="h-4 w-4" />
                    )}
                    {marketingHealth?.boundToUser ? 'Re-bind Marketing' : 'Connect Marketing'}
                  </button>
                </div>
              )}

              {(health?.graphError || pageHealth?.graphError || marketingHealth?.graphError) && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                  {[health?.graphError, pageHealth?.graphError, marketingHealth?.graphError]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {(overview?.channels || []).map((channel) => (
                  <div key={channel.id} className="border border-slate-200 bg-white px-3 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Channel
                    </div>
                    <div className="mt-1 text-sm font-medium text-slate-900">{channel.name}</div>
                    <div className="mt-1 text-xs capitalize text-slate-500">
                      {channel.kind.replace(/_/g, ' ')} · {channel.status}
                    </div>
                  </div>
                ))}
                {(overview?.connectors || []).map((connector) => (
                  <div key={connector.id} className="border border-slate-200 bg-slate-50 px-3 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Connector
                    </div>
                    <div className="mt-1 text-sm font-medium text-slate-900">{connector.name}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {connector.provider} · {connector.status}
                    </div>
                  </div>
                ))}
                {(overview?.channels || []).length === 0 &&
                  (overview?.connectors || []).length === 0 && (
                    <p className="text-sm text-slate-500 sm:col-span-2">
                      No channels bound yet
                      {canManageIntegrations
                        ? ' — use Connect above after Meta env is configured.'
                        : '.'}
                    </p>
                  )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
