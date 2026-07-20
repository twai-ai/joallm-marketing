import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  Bot,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  Clapperboard,
  CreditCard,
  Database,
  FileClock,
  FileText,
  FolderOpen,
  Layers3,
  MessageSquare,
  Search,
  Sparkles,
  Users,
  Workflow,
} from 'lucide-react';
import { StandaloneLogo } from '../components/ui/Logo';
import {
  PLATFORM_CONSTITUTION,
  PLATFORM_TAGLINE,
  PRODUCT_DESCRIPTIONS,
  PRODUCT_LABELS,
  PRODUCT_ROUTES,
} from '../constants/product';
import { STUDIO_FAMILIES } from '../constants/workflowFamilies';
import { MODALITY_CAPABILITIES, MULTIMODAL_PROCESSING_MODES } from '../constants/modalities';
import { useUserRole } from '../contexts/EnhancedUserRoleContext';
import { apiClient } from '../utils/api-client';
import { mapBackendFileToKnowledgeDocument, type KnowledgeDocument } from '../domain/knowledge';
import { workflowApi, type Workflow as WorkflowRecord } from '../services/workflowApi';
import { subscriptionsApi, type CurrentSubscription, type UsageResponse } from '../services/subscriptionsApi';

type RecentChat = {
  id: string;
  shortId?: string;
  title?: string;
  model?: string;
  createdAt: string;
  updatedAt: string;
  messageCount?: number;
};

const formatRelative = (value?: string) => {
  if (!value) {
    return 'Recently';
  }

  const timestamp = new Date(value).getTime();
  const diffMs = Date.now() - timestamp;
  const minutes = Math.max(1, Math.round(diffMs / 60000));

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.round(hours / 24);
  return `${days}d ago`;
};

const formatNumber = (value?: number | null) => new Intl.NumberFormat().format(value ?? 0);

function DashboardCard({
  title,
  description,
  icon: Icon,
  value,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  value: string;
}) {
  return (
    <div className="rounded-3xl border border-gray-200 bg-white/90 p-4 shadow-sm backdrop-blur-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500 sm:text-xs sm:tracking-[0.22em]">{title}</p>
          <p className="mt-2 break-words text-xl font-semibold leading-tight text-gray-900 sm:mt-3 sm:text-2xl">{value}</p>
          <p className="mt-2 text-sm leading-5 text-gray-600 sm:leading-6">{description}</p>
        </div>
        <div className="rounded-2xl bg-teal-50 p-2.5 text-joa-primary sm:p-3">
          <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
        </div>
      </div>
    </div>
  );
}

export function WelcomePage() {
  const navigate = useNavigate();
  const { canAccess, getRoleConfig } = useUserRole();
  const roleConfig = getRoleConfig();

  const { data: documents = [] } = useQuery({
    queryKey: ['workspace-home', 'documents'],
    queryFn: async () => {
      const response = await apiClient.get<{ files: KnowledgeDocument[] | any[] }>('/api/files?limit=100', {
        showErrorToast: false,
      });
      return (response.files || []).map(mapBackendFileToKnowledgeDocument);
    },
    staleTime: 60_000,
  });

  const { data: recentChats = [] } = useQuery({
    queryKey: ['workspace-home', 'recent-chats'],
    queryFn: async () => {
      const response = await apiClient.get<{ sessions: RecentChat[] }>('/api/chat/sessions?limit=5', {
        showErrorToast: false,
      });
      return response.sessions || [];
    },
    staleTime: 60_000,
  });

  const { data: workflows = [] } = useQuery({
    queryKey: ['workspace-home', 'workflows'],
    queryFn: async () => workflowApi.listWorkflows(),
    staleTime: 60_000,
    retry: false,
  });

  const { data: subscription } = useQuery<CurrentSubscription | null>({
    queryKey: ['workspace-home', 'subscription'],
    queryFn: async () => {
      try {
        return await subscriptionsApi.getCurrent();
      } catch {
        return null;
      }
    },
    staleTime: 60_000,
  });

  const { data: usage } = useQuery<UsageResponse | null>({
    queryKey: ['workspace-home', 'usage'],
    queryFn: async () => {
      try {
        return await subscriptionsApi.getUsage(30);
      } catch {
        return null;
      }
    },
    staleTime: 60_000,
  });

  const readyDocuments = useMemo(() => documents.filter((document) => document.isReady), [documents]);
  const processingDocuments = useMemo(() => documents.filter((document) => document.isProcessing), [documents]);
  const failedDocuments = useMemo(() => documents.filter((document) => document.hasFailed), [documents]);
  const latestDocument = [...documents].sort((left, right) => {
    const leftTime = new Date(left.uploadedAt || left.uploadDate || 0).getTime();
    const rightTime = new Date(right.uploadedAt || right.uploadDate || 0).getTime();
    return rightTime - leftTime;
  })[0];
  const latestWorkflow = [...workflows].sort((left, right) => {
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  })[0];
  const latestChat = [...recentChats].sort((left, right) => {
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  })[0];

  const continueCards = [
    latestChat
      ? {
          title: 'Resume Chat',
          description: latestChat.title || 'Untitled chat',
          helper: `${latestChat.model || 'AI model'} • ${latestChat.messageCount || 0} messages • ${formatRelative(latestChat.updatedAt)}`,
          action: 'Open thread',
          onClick: () => navigate(`/chat/${latestChat.shortId || latestChat.id}`),
          icon: MessageSquare,
        }
      : {
          title: 'Start Chat',
          description: 'Open a fresh thread and ask your first grounded question.',
          helper: 'Best next step if you already know what you want to ask.',
          action: 'Go to Chat',
          onClick: () => navigate(PRODUCT_ROUTES.chat),
          icon: MessageSquare,
        },
    latestDocument
      ? {
          title: processingDocuments.length > 0 ? 'Knowledge Still Indexing' : 'Knowledge Ready',
          description: latestDocument.displayName,
          helper:
            processingDocuments.length > 0
              ? `${processingDocuments.length} document${processingDocuments.length === 1 ? '' : 's'} still processing`
              : `${readyDocuments.length} ready for grounded answers`,
          action: 'Open Knowledge',
          onClick: () => navigate(PRODUCT_ROUTES.knowledge),
          icon: processingDocuments.length > 0 ? FileClock : Search,
        }
      : {
          title: 'Upload Knowledge',
          description: 'Bring in one or two documents you know well.',
          helper: 'The fastest activation path in this product.',
          action: 'Open Knowledge',
          onClick: () => navigate(PRODUCT_ROUTES.knowledge),
          icon: Database,
        },
    canAccess('workflow')
      ? latestWorkflow
        ? {
            title: 'Continue in Studio',
            description: latestWorkflow.name,
            helper: `${latestWorkflow.nodes?.length ?? 0} nodes • ${formatRelative(latestWorkflow.updatedAt)}`,
            action: 'Open Studio canvas',
            onClick: () => navigate(`/studio/custom/${latestWorkflow.id}`),
            icon: Workflow,
          }
        : {
            title: 'Open Studio',
            description: 'Enter guided workspaces for Media, Documents, and Acquisition.',
            helper: 'Studio creates. ATRISI Marketing operates on Timelines and Knowledge.',
            action: 'Open Studio',
            onClick: () => navigate(PRODUCT_ROUTES.workflows),
            icon: Workflow,
          }
      : null,
  ].filter(Boolean) as Array<{
    title: string;
    description: string;
    helper: string;
    action: string;
    onClick: () => void;
    icon: React.ComponentType<{ className?: string }>;
  }>;

  const launchPads = [
    {
      label: PRODUCT_LABELS.chat,
      route: PRODUCT_ROUTES.chat,
      description: PRODUCT_DESCRIPTIONS.chat,
      icon: MessageSquare,
      enabled: canAccess('chat'),
    },
    {
      label: PRODUCT_LABELS.knowledge,
      route: PRODUCT_ROUTES.knowledge,
      description: PRODUCT_DESCRIPTIONS.knowledge,
      icon: Search,
      enabled: canAccess('rag-search'),
    },
    {
      label: PRODUCT_LABELS.workflows,
      route: PRODUCT_ROUTES.workflows,
      description: PRODUCT_DESCRIPTIONS.workflows,
      icon: Workflow,
      enabled: canAccess('workflow'),
    },
    {
      label: PRODUCT_LABELS.models,
      route: PRODUCT_ROUTES.models,
      description: PRODUCT_DESCRIPTIONS.models,
      icon: BrainCircuit,
      enabled: canAccess('farm'),
    },
  ].filter((item) => item.enabled);

  const tierLabel = subscription ? subscription.tier.charAt(0).toUpperCase() + subscription.tier.slice(1) : 'Free';
  const familyIcons = {
    media: Clapperboard,
    acquisition: Users,
    'docs-ai': FileText,
    'data-intelligence': Database,
    'marketing-studio': Sparkles,
    custom: Workflow,
  } as const;

  return (
    <div className="min-h-screen overflow-y-auto bg-[radial-gradient(circle_at_top,_#eff6ff,_#f8fafc_42%,_#ffffff_100%)]">
      <div className="workspace-shell px-0 py-6 sm:py-8 md:py-14">
        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:gap-8 workspace-split-dashboard">
          <div className="space-y-6 sm:space-y-8">
            <div className="flex items-center justify-between gap-3 sm:gap-4">
              <StandaloneLogo />
              <div className="hidden rounded-full border border-gray-200 bg-white/90 px-4 py-2 text-sm font-medium text-gray-700 shadow-sm md:inline-flex">
                {roleConfig.name} workspace
              </div>
            </div>

            <div className="space-y-4 sm:space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-joa-primary shadow-sm sm:px-4 sm:py-2 sm:text-sm">
                <Sparkles className="h-4 w-4" />
                ATRISI Marketing · Brain
              </div>

              <div>
                <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl md:text-6xl">
                  {PLATFORM_TAGLINE}
                </h1>
                <p className="mt-3 max-w-3xl text-base leading-7 text-gray-600 sm:mt-4 sm:text-lg sm:leading-relaxed md:text-xl">
                  {PLATFORM_CONSTITUTION} Use Chat and Knowledge to operate; open Studio to create via
                  Media AI, Document AI, and Acquisition Intelligence.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <button
                  onClick={() => navigate(PRODUCT_ROUTES.media)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-joa-primary px-5 py-3 font-medium text-white shadow-lg shadow-teal-200/40 transition hover:bg-teal-800 sm:w-auto"
                >
                  <Clapperboard className="h-5 w-5" />
                  Open Media AI
                </button>
                <button
                  onClick={() => navigate(PRODUCT_ROUTES.workflows)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-5 py-3 font-medium text-gray-800 transition hover:border-gray-400 hover:bg-gray-50 sm:w-auto"
                >
                  <Workflow className="h-5 w-5" />
                  Open Studio
                </button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <DashboardCard
                title="Ready Documents"
                value={formatNumber(readyDocuments.length)}
                description="Knowledge assets that can already support grounded answers."
                icon={CheckCircle2}
              />
              <DashboardCard
                title="Indexing Now"
                value={formatNumber(processingDocuments.length)}
                description="Documents still being prepared for retrieval."
                icon={FileClock}
              />
              <DashboardCard
                title="Recent Chats"
                value={formatNumber(recentChats.length)}
                description="Conversation threads available to resume quickly."
                icon={MessageSquare}
              />
              <DashboardCard
                title="Plan & Usage"
                value={`${tierLabel} • ${formatNumber(usage?.totals.totalRequests)} req`}
                description="Current subscription and recent activity from the backend."
                icon={CreditCard}
              />
            </div>

            <section className="rounded-3xl border border-gray-200 bg-white/90 p-4 shadow-sm backdrop-blur-sm sm:p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-gray-500">Continue Working</p>
                  <h2 className="mt-2 text-xl font-semibold text-gray-900 sm:text-2xl">Jump back into the most relevant surface</h2>
                </div>
              </div>
              <div className="mt-5 grid gap-3 sm:mt-6 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
                {continueCards.map((card) => (
                  <button
                    key={card.title}
                    onClick={card.onClick}
                    className="group rounded-2xl border border-gray-200 bg-gray-50/80 p-4 text-left transition hover:-translate-y-1 hover:border-teal-200 hover:bg-white hover:shadow-lg sm:p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-joa-primary shadow-sm sm:h-12 sm:w-12">
                        <card.icon className="h-5 w-5" />
                      </div>
                      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-gray-400 transition group-hover:translate-x-1 group-hover:text-joa-primary" />
                    </div>
                    <h3 className="mt-4 text-base font-semibold text-gray-900 sm:mt-5 sm:text-lg">{card.title}</h3>
                    <p className="mt-2 break-words text-sm font-medium text-gray-800">{card.description}</p>
                    <p className="mt-2 text-sm leading-5 text-gray-600 sm:leading-6">{card.helper}</p>
                    <div className="mt-4 text-sm font-medium text-joa-primary">{card.action}</div>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-gray-200 bg-white/90 p-4 shadow-sm backdrop-blur-sm sm:p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-gray-500">Studio workspaces</p>
                  <h2 className="mt-2 text-xl font-semibold text-gray-900 sm:text-2xl">
                    Choose the Studio that matches the job
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
                    Media AI, Acquisition Intelligence, and Document AI are live. Marketing Studio and Data
                    Intelligence stay visible as Soon without looking ready to click.
                  </p>
                </div>
              </div>
              <div className="mt-5 grid gap-3 sm:mt-6 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
                {STUDIO_FAMILIES.map((family) => {
                  const Icon = familyIcons[family.id] ?? Workflow;
                  const isActive = family.status === 'active';
                  const isAdvanced = family.status === 'advanced';
                  const isClickable = isActive || isAdvanced;
                  return (
                    <button
                      key={family.id}
                      onClick={isClickable ? () => navigate(family.route) : undefined}
                      disabled={!isClickable}
                      className={`group rounded-2xl border p-4 text-left transition hover:-translate-y-1 hover:shadow-lg disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none sm:p-5 ${
                        isActive
                          ? 'border-teal-200 bg-teal-50/70 hover:bg-white'
                          : isAdvanced
                          ? 'border-slate-300 bg-slate-50 hover:bg-white'
                          : 'border-dashed border-gray-300 bg-gray-50/70 hover:bg-gray-50/70'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl shadow-sm ${
                          isActive ? 'bg-white text-joa-primary' : 'bg-white text-slate-600'
                        }`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          isActive
                            ? 'bg-teal-100 text-joa-primary'
                            : isAdvanced
                            ? 'bg-slate-200 text-slate-700'
                            : 'bg-gray-200 text-gray-600'
                        }`}>
                          {isActive ? 'Active' : isAdvanced ? 'Advanced' : 'Placeholder'}
                        </div>
                      </div>
                      <h3 className="mt-4 text-base font-semibold text-gray-900 sm:mt-5 sm:text-lg">{family.label}</h3>
                      <p className="mt-2 text-sm leading-6 text-gray-600">{family.description}</p>
                      <p className="mt-3 text-xs leading-5 text-gray-500">{family.helper}</p>
                      <div className="mt-4 flex items-center justify-between text-sm font-medium">
                        <span className={`min-w-0 pr-3 ${isClickable ? 'text-gray-700' : 'text-gray-500'}`}>{family.audience}</span>
                        <ArrowRight className={`h-4 w-4 shrink-0 ${isClickable ? 'text-gray-400 transition group-hover:translate-x-1 group-hover:text-joa-primary' : 'text-gray-300'}`} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-gray-200 bg-white/90 p-4 shadow-xl shadow-blue-100 sm:p-6">
              <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-5 text-white sm:p-6">
                <p className="text-sm font-medium text-blue-200">Operational snapshot</p>
                <div className="mt-5 space-y-4">
                  <div className="flex items-start gap-3">
                    <FolderOpen className="mt-0.5 h-5 w-5 text-emerald-400" />
                    <div>
                      <p className="font-medium">Knowledge readiness</p>
                      <p className="text-sm text-slate-300">
                        {readyDocuments.length > 0
                          ? `${readyDocuments.length} document${readyDocuments.length === 1 ? '' : 's'} ready for grounded answers`
                          : 'No ready documents yet'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Clock3 className="mt-0.5 h-5 w-5 text-amber-400" />
                    <div>
                      <p className="font-medium">Processing queue</p>
                      <p className="text-sm text-slate-300">
                        {processingDocuments.length > 0
                          ? `${processingDocuments.length} item${processingDocuments.length === 1 ? '' : 's'} still indexing`
                          : 'Nothing currently waiting on indexing'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Layers3 className="mt-0.5 h-5 w-5 text-blue-300" />
                    <div>
                      <p className="font-medium">Studio canvas inventory</p>
                      <p className="text-sm text-slate-300">
                        {workflows.length > 0
                          ? `${workflows.length} custom canvas${workflows.length === 1 ? '' : 'es'} available`
                          : 'No custom Studio canvases yet — start from a guided workspace'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Bot className="mt-0.5 h-5 w-5 text-pink-300" />
                    <div>
                      <p className="font-medium">Usage signal</p>
                      <p className="text-sm text-slate-300">
                        {usage ? `${formatNumber(usage.totals.totalTokens)} tokens tracked over the last ${usage.days} days` : 'Usage data will appear when backend metrics are available'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Attention Needed</h3>
                    <p className="mt-1 text-sm text-gray-600">System states that deserve a quick look before you keep moving.</p>
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  {processingDocuments.length > 0 ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                      <p className="font-medium text-amber-900">Documents are still indexing</p>
                      <p className="mt-1 text-sm text-amber-700">
                        Wait for ready status before judging answer quality in chat.
                      </p>
                    </div>
                  ) : null}
                  {failedDocuments.length > 0 ? (
                    <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                      <p className="font-medium text-red-900">Some knowledge processing failed</p>
                      <p className="mt-1 text-sm text-red-700">
                        Open Knowledge to reprocess or inspect failed documents.
                      </p>
                    </div>
                  ) : null}
                  {readyDocuments.length === 0 ? (
                    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                      <p className="font-medium text-blue-900">No grounded context yet</p>
                      <p className="mt-1 text-sm text-blue-700">
                        Upload one document to unlock the fastest product aha moment.
                      </p>
                    </div>
                  ) : null}
                  {!processingDocuments.length && !failedDocuments.length && readyDocuments.length > 0 ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                      <p className="font-medium text-emerald-900">Workspace looks healthy</p>
                      <p className="mt-1 text-sm text-emerald-700">
                        Your knowledge base is ready. Chat is the best next place to verify value.
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-gray-200 bg-white/90 p-4 shadow-sm sm:p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-50 text-joa-primary">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Launch Pads</h3>
                  <p className="text-sm text-gray-600">Quick entry points based on what this workspace can access.</p>
                </div>
              </div>
              <div className="mt-5 space-y-3">
                {launchPads.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => navigate(item.route)}
                    className="group flex w-full items-start justify-between gap-3 rounded-2xl border border-gray-200 bg-gray-50/80 px-4 py-4 text-left transition hover:border-teal-200 hover:bg-white"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-joa-primary shadow-sm">
                        <item.icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900">{item.label}</p>
                        <p className="mt-1 text-sm text-gray-600">{item.description}</p>
                      </div>
                    </div>
                    <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-gray-400 transition group-hover:translate-x-1 group-hover:text-joa-primary" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-[32px] border border-gray-200 bg-white/82 p-4 shadow-[0_18px_48px_rgba(15,23,42,0.08)] backdrop-blur-sm sm:p-6 md:mt-10 md:p-8">
          <div className="grid gap-8 xl:grid-cols-[0.82fr_1.18fr]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-medium text-joa-primary shadow-sm sm:px-4 sm:py-2 sm:text-sm">
                <Layers3 className="h-4 w-4" />
                Core modalities
              </div>
              <h2 className="app-display mt-4 text-2xl font-bold tracking-tight text-gray-900 sm:mt-5 sm:text-3xl md:text-4xl">
                The platform is evolving from text-first AI into a multimodal workspace
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600 sm:mt-4 sm:text-base sm:leading-7 md:text-lg">
                ATRISI Marketing is the Brain for institutional knowledge and relationships.
                Studio workspaces (Media, Documents, Acquisition, Marketing) create intent;
                Platform remembers Timelines, Knowledge Artifacts, Connectors, and Creative AI.
              </p>
              <div className="mt-5 space-y-2">
                {MULTIMODAL_PROCESSING_MODES.map((mode) => (
                  <div key={mode.id} className="rounded-2xl border border-gray-200 bg-gray-50/80 px-4 py-3">
                    <div className="text-sm font-semibold text-gray-900">{mode.label}</div>
                    <div className="mt-1 text-sm text-gray-600">{mode.description}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
              {MODALITY_CAPABILITIES.map((capability) => (
                <button
                  key={capability.id}
                  onClick={() => navigate(capability.route)}
                  className="rounded-[28px] border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-lg sm:p-5"
                >
                  <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${capability.accentClass}`}>
                    <capability.icon className="h-3.5 w-3.5" />
                    {capability.label}
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-gray-900 sm:text-lg">{capability.description}</h3>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {capability.examples.map((example) => (
                      <span key={example} className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                        {example}
                      </span>
                    ))}
                  </div>
                  <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-joa-primary">
                    Explore
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
