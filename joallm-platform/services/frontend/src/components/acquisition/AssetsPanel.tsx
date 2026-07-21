import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type FormEvent } from 'react';
import { FolderPlus, Loader2, Plus, Send, Sparkles, Trash2, Upload } from 'lucide-react';
import type {
  AcquisitionCampaign,
  ChannelKind,
  CreativeProject,
  GrowthAssetKind,
  GrowthMarketingAsset,
  ImageGenerationQuality,
  ImageGenerationStyle,
} from '@joallm/shared';
import { API_ENDPOINTS } from '../../config/api';
import { getIntentById } from '../../constants/growthIntents';
import {
  CREATIVE_SIZE_OPTIONS,
  defaultSizeForStyle,
  type CreativeSizeId,
} from '../../constants/creativeSizes';
import { apiClient } from '../../utils/api-client';
import { showError, showSuccess } from '../../utils/toast';
import { CHANNEL_OPTIONS } from './PublishingPanel';

function kindFromFile(file: File): GrowthAssetKind {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  return 'other';
}

const STYLE_OPTIONS: { value: ImageGenerationStyle; label: string }[] = [
  { value: 'marketing_poster', label: 'Marketing poster / flyer' },
  { value: 'social_media', label: 'Social media card' },
  { value: 'hero_banner', label: 'Hero banner' },
  { value: 'infographic', label: 'Infographic' },
  { value: 'illustration', label: 'Illustration' },
  { value: 'photo_realistic', label: 'Photoreal' },
  { value: 'logo', label: 'Logo mark' },
  { value: 'other', label: 'Other' },
];

const QUALITY_OPTIONS: { value: ImageGenerationQuality; label: string }[] = [
  { value: 'draft', label: 'Draft (fast)' },
  { value: 'standard', label: 'Standard' },
  { value: 'premium', label: 'Premium' },
];

type ProviderChoice = 'auto' | 'ideogram' | 'flux';

function buildDefaultPrompt(
  programId: string,
  programName: string,
  campaign?: AcquisitionCampaign | null,
): string {
  const intent = campaign?.intentId
    ? getIntentById(programId, campaign.intentId)
    : undefined;
  const cta = intent?.cta || 'Learn more';
  const purpose = intent?.purpose || 'Acquire program interest from the market';
  const intentLabel = intent?.name || 'Registration';

  return [
    `Professional institutional marketing flyer for "${programName}".`,
    `Growth intent: ${intentLabel} — ${purpose}.`,
    `Clear headline area with program name, short supporting line, and CTA "${cta}".`,
    'Clean modern design, high contrast, ample negative space, print-ready poster, no clutter, no fake logos.',
  ].join(' ');
}

export function AssetsPanel({
  programId,
  programName,
  campaigns,
  campaignsLoading,
  preferredCampaignId,
  onCampaignsChanged,
  onGoToCampaigns,
  onGoToPublishing,
}: {
  programId: string;
  programName: string;
  campaigns: AcquisitionCampaign[];
  campaignsLoading: boolean;
  preferredCampaignId?: string | null;
  onCampaignsChanged: () => Promise<void> | void;
  onGoToCampaigns: () => void;
  onGoToPublishing?: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [campaignId, setCampaignId] = useState('');
  const [projects, setProjects] = useState<CreativeProject[]>([]);
  const [assets, setAssets] = useState<GrowthMarketingAsset[]>([]);
  const [projectId, setProjectId] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [savingProject, setSavingProject] = useState(false);
  const [publishingAssetId, setPublishingAssetId] = useState<string | null>(null);
  const [publishChannel, setPublishChannel] = useState<ChannelKind>('linkedin_organic');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [messageBody, setMessageBody] = useState('');

  const [genPrompt, setGenPrompt] = useState('');
  const [genTitle, setGenTitle] = useState('');
  const [genStyle, setGenStyle] = useState<ImageGenerationStyle>('marketing_poster');
  const [genQuality, setGenQuality] = useState<ImageGenerationQuality>('standard');
  const [genProvider, setGenProvider] = useState<ProviderChoice>('auto');
  const [genSize, setGenSize] = useState<CreativeSizeId>('3x4');
  const [genMedia, setGenMedia] = useState<'image' | 'video'>('image');
  const [referenceFileIds, setReferenceFileIds] = useState<string[]>([]);
  const [referenceMode, setReferenceMode] = useState<'style' | 'edit'>('style');
  const [uploadingRefs, setUploadingRefs] = useState(false);
  const refInputRef = useRef<HTMLInputElement>(null);

  const selectedCampaign = useMemo(
    () => campaigns.find((c) => c.id === campaignId) || null,
    [campaigns, campaignId],
  );

  useEffect(() => {
    if (preferredCampaignId && campaigns.some((c) => c.id === preferredCampaignId)) {
      setCampaignId(preferredCampaignId);
      return;
    }
    if (!campaignId && campaigns[0]) {
      setCampaignId(campaigns[0].id);
    }
  }, [campaigns, campaignId, preferredCampaignId]);

  useEffect(() => {
    // Prefill prompt when campaign/program changes and user hasn't customized yet
    setGenPrompt((current) => {
      if (current.trim().length > 0 && !current.includes(programName)) {
        return current;
      }
      return buildDefaultPrompt(programId, programName, selectedCampaign);
    });
    if (!genTitle.trim()) {
      const intentName = selectedCampaign?.intentId
        ? getIntentById(programId, selectedCampaign.intentId)?.name
        : undefined;
      setGenTitle(
        intentName ? `${programName} · ${intentName} flyer` : `${programName} acquisition flyer`,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only refresh defaults when campaign/program shifts
  }, [programId, programName, selectedCampaign?.id, selectedCampaign?.intentId]);

  const load = useCallback(async (targetCampaignId?: string) => {
    const id = targetCampaignId || campaignId;
    if (!id) {
      setProjects([]);
      setAssets([]);
      return;
    }
    setLoading(true);
    try {
      const base = `/api/acquisition/programs/${encodeURIComponent(programId)}/campaigns/${id}`;
      const [projectsRes, assetsRes] = await Promise.all([
        apiClient.get<{ success: boolean; data: CreativeProject[] }>(`${base}/creative-projects`),
        apiClient.get<{ success: boolean; data: GrowthMarketingAsset[] }>(`${base}/assets`),
      ]);
      const nextProjects = projectsRes.data || [];
      setProjects(nextProjects);
      setAssets(assetsRes.data || []);
      setProjectId((current) =>
        current && !nextProjects.some((p) => p.id === current) ? '' : current,
      );
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to load assets');
    } finally {
      setLoading(false);
    }
  }, [campaignId, programId]);

  useEffect(() => {
    void load();
  }, [load]);

  const ensureCampaignId = async (): Promise<string | null> => {
    if (campaignId) return campaignId;
    if (campaigns[0]) {
      setCampaignId(campaigns[0].id);
      return campaigns[0].id;
    }

    // Complete the loop: first upload creates a Registration campaign automatically
    try {
      const created = await apiClient.post<{ success: boolean; data: AcquisitionCampaign }>(
        `/api/acquisition/programs/${encodeURIComponent(programId)}/campaigns`,
        {
          name: `${programName} asset upload`,
          programName,
          intentId: 'registration',
          status: 'draft',
        },
      );
      const id = created.data.id;
      setCampaignId(id);
      await onCampaignsChanged();
      showSuccess('Created a Registration campaign for your assets');
      return id;
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Could not create a campaign for upload');
      return null;
    }
  };

  const ensureProjectId = async (
    forCampaignId: string,
    existingProjects: CreativeProject[],
  ): Promise<string | null> => {
    if (projectId) return projectId;
    if (existingProjects[0]) {
      setProjectId(existingProjects[0].id);
      return existingProjects[0].id;
    }
    try {
      const created = await apiClient.post<{ success: boolean; data: CreativeProject }>(
        `/api/acquisition/programs/${encodeURIComponent(programId)}/campaigns/${forCampaignId}/creative-projects`,
        { name: 'Default creatives', status: 'active' },
      );
      setProjectId(created.data.id);
      return created.data.id;
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Could not create creative project');
      return null;
    }
  };

  const handleGenerate = async (event: FormEvent) => {
    event.preventDefault();
    if (genMedia === 'video') {
      showError(
        'Ideogram API does not offer video generation yet — use image sizes (e.g. 9:16 Story still).',
      );
      return;
    }
    if (!genPrompt.trim()) {
      showError('Add a prompt for the creative');
      return;
    }

    setGenerating(true);
    try {
      const targetCampaignId = await ensureCampaignId();
      if (!targetCampaignId) return;

      let campaignProjects = projects;
      if (targetCampaignId !== campaignId || projects.length === 0) {
        const res = await apiClient.get<{ success: boolean; data: CreativeProject[] }>(
          `/api/acquisition/programs/${encodeURIComponent(programId)}/campaigns/${targetCampaignId}/creative-projects`,
        );
        campaignProjects = res.data || [];
        setProjects(campaignProjects);
      }

      const targetProjectId = await ensureProjectId(targetCampaignId, campaignProjects);

      const res = await apiClient.post<{
        success: boolean;
        data: {
          asset: GrowthMarketingAsset;
          provider: string;
          modelId: string;
        };
      }>(
        `/api/acquisition/programs/${encodeURIComponent(programId)}/campaigns/${targetCampaignId}/assets/generate`,
        {
          prompt: genPrompt.trim(),
          title: genTitle.trim() || undefined,
          style: genStyle,
          quality: genQuality,
          providerOverride: genProvider,
          aspectRatio: genSize,
          creativeProjectId: targetProjectId || undefined,
          referenceFileIds: referenceFileIds.length ? referenceFileIds : undefined,
          referenceMode: referenceFileIds.length ? referenceMode : undefined,
          kind:
            genStyle === 'marketing_poster' || genStyle === 'infographic'
              ? 'poster'
              : genStyle === 'hero_banner'
                ? 'landing_hero'
                : 'image',
        },
      );

      showSuccess(`Creative generated with ${res.data.provider} (${res.data.modelId})`);
      await load(targetCampaignId);
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const toggleReferenceFile = (fileId: string) => {
    setReferenceFileIds((current) => {
      if (current.includes(fileId)) {
        return current.filter((id) => id !== fileId);
      }
      if (current.length >= 4) {
        showError('You can attach up to 4 reference images');
        return current;
      }
      return [...current, fileId];
    });
  };

  const handleUploadReferences = async (fileList: FileList | File[] | null) => {
    const files = fileList ? Array.from(fileList) : [];
    if (!files.length) return;
    const room = 4 - referenceFileIds.length;
    if (room <= 0) {
      showError('You can attach up to 4 reference images');
      return;
    }

    setUploadingRefs(true);
    try {
      const nextIds = [...referenceFileIds];
      for (const file of files.slice(0, room)) {
        if (!file.type.startsWith('image/')) {
          showError(`${file.name} is not an image`);
          continue;
        }
        const uploaded = await apiClient.uploadFile<{ fileId?: string; id?: string }>(
          API_ENDPOINTS.files.upload,
          file,
        );
        const fileId = uploaded.fileId || uploaded.id;
        if (!fileId) throw new Error(`Upload failed for ${file.name}`);
        if (!nextIds.includes(fileId)) nextIds.push(fileId);
      }
      setReferenceFileIds(nextIds.slice(0, 4));
      showSuccess(
        nextIds.length === referenceFileIds.length
          ? 'No new references added'
          : `Added ${nextIds.length - referenceFileIds.length} reference image(s)`,
      );
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Reference upload failed');
    } finally {
      setUploadingRefs(false);
    }
  };

  const handleUpload = async (fileList: FileList | File[] | null) => {
    const files = fileList ? Array.from(fileList) : [];
    if (!files.length) return;

    setUploading(true);
    try {
      const targetCampaignId = await ensureCampaignId();
      if (!targetCampaignId) return;

      // Refresh projects for the campaign we will use
      let campaignProjects = projects;
      if (targetCampaignId !== campaignId || projects.length === 0) {
        const res = await apiClient.get<{ success: boolean; data: CreativeProject[] }>(
          `/api/acquisition/programs/${encodeURIComponent(programId)}/campaigns/${targetCampaignId}/creative-projects`,
        );
        campaignProjects = res.data || [];
        setProjects(campaignProjects);
      }

      const targetProjectId = await ensureProjectId(targetCampaignId, campaignProjects);
      if (!targetProjectId) return;

      for (const file of files) {
        const uploaded = await apiClient.uploadFile<{ fileId?: string; id?: string }>(
          API_ENDPOINTS.files.upload,
          file,
        );
        const fileId = uploaded.fileId || uploaded.id;
        if (!fileId) {
          throw new Error(`Upload failed for ${file.name}`);
        }
        await apiClient.post(
          `/api/acquisition/programs/${encodeURIComponent(programId)}/campaigns/${targetCampaignId}/creative-projects/${targetProjectId}/assets`,
          {
            title: file.name.replace(/\.[^.]+$/, '') || file.name,
            kind: kindFromFile(file),
            fileIds: [fileId],
            status: 'draft',
          },
        );
      }
      showSuccess(files.length === 1 ? 'Asset uploaded' : `${files.length} assets uploaded`);
      await load(targetCampaignId);
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleCreateProject = async (event: FormEvent) => {
    event.preventDefault();
    const targetCampaignId = await ensureCampaignId();
    if (!targetCampaignId || !projectName.trim()) return;
    setSavingProject(true);
    try {
      const res = await apiClient.post<{ success: boolean; data: CreativeProject }>(
        `/api/acquisition/programs/${encodeURIComponent(programId)}/campaigns/${targetCampaignId}/creative-projects`,
        { name: projectName.trim(), status: 'active' },
      );
      showSuccess('Creative project created');
      setProjectName('');
      setShowProjectForm(false);
      setProjectId(res.data.id);
      await load(targetCampaignId);
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to create project');
    } finally {
      setSavingProject(false);
    }
  };

  const handlePublish = async (asset: GrowthMarketingAsset) => {
    if (!campaignId) return;
    setPublishingAssetId(asset.id);
    try {
      const job = await apiClient.post<{
        success: boolean;
        data: { status: string; executeMode?: string; externalPostId?: string | null };
      }>(
        `/api/acquisition/programs/${encodeURIComponent(programId)}/campaigns/${campaignId}/assets/${asset.id}/publish`,
        {
          channelKind: publishChannel,
          status: 'queued',
          executeNow: true,
          ...(publishChannel === 'whatsapp' && recipientPhone.trim()
            ? { recipientPhone: recipientPhone.trim() }
            : {}),
          ...(messageBody.trim() ? { messageBody: messageBody.trim() } : {}),
        },
      );
      const status = job.data?.status || 'queued';
      showSuccess(
        status === 'published'
          ? `Published to ${publishChannel}`
          : `Queued for ${publishChannel}`,
      );
      onGoToPublishing?.();
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to publish');
    } finally {
      setPublishingAssetId(null);
    }
  };

  const handleDeleteAsset = async (asset: GrowthMarketingAsset) => {
    if (!campaignId) return;
    if (!window.confirm(`Delete asset “${asset.title}”?`)) return;
    try {
      await apiClient.delete(
        `/api/acquisition/programs/${encodeURIComponent(programId)}/campaigns/${campaignId}/assets/${asset.id}`,
      );
      showSuccess('Asset deleted');
      await load();
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to delete asset');
    }
  };

  const handleDeleteProject = async (project: CreativeProject) => {
    if (!campaignId) return;
    if (!window.confirm(`Delete creative project “${project.name}” and its assets?`)) return;
    try {
      await apiClient.delete(
        `/api/acquisition/programs/${encodeURIComponent(programId)}/campaigns/${campaignId}/creative-projects/${project.id}`,
      );
      showSuccess('Creative project deleted');
      if (projectId === project.id) setProjectId('');
      await load();
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to delete project');
    }
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    void handleUpload(event.dataTransfer.files);
  };

  const visibleAssets = projectId
    ? assets.filter((a) => a.creativeProjectId === projectId)
    : assets;

  if (campaignsLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading…
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">Generate creatives</h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Creative AI builds a flyer/poster for this acquisition campaign (Ideogram for text-heavy
              posters, FLUX for photoreal drafts). Result is saved as a draft Marketing Asset you can
              publish.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-teal-800 ring-1 ring-teal-200">
            <Sparkles className="h-3.5 w-3.5" />
            Ideogram · FLUX
          </span>
        </div>

        <form onSubmit={handleGenerate} className="mt-5 space-y-4">
          {campaigns.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="text-xs font-medium text-slate-600">Campaign</span>
                <select
                  value={campaignId}
                  onChange={(e) => {
                    setCampaignId(e.target.value);
                    setProjectId('');
                  }}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-400"
                >
                  {campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>
                      {campaign.name}
                      {campaign.intentId ? ` · ${campaign.intentId}` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-xs font-medium text-slate-600">Creative project (optional)</span>
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-400"
                >
                  <option value="">Default creatives</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          <label className="block text-sm">
            <span className="text-xs font-medium text-slate-600">Prompt</span>
            <textarea
              value={genPrompt}
              onChange={(e) => setGenPrompt(e.target.value)}
              rows={4}
              required
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-400"
              placeholder="Describe the flyer…"
            />
          </label>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-950">Media & size</h3>
                <p className="mt-1 text-xs text-slate-600">
                  Pick the output format for this acquisition creative.
                </p>
              </div>
              <div className="inline-flex rounded-full border border-slate-200 bg-white p-1 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setGenMedia('image')}
                  className={`rounded-full px-3 py-1.5 ${
                    genMedia === 'image' ? 'bg-teal-600 text-white' : 'text-slate-600'
                  }`}
                >
                  Image
                </button>
                <button
                  type="button"
                  onClick={() => setGenMedia('video')}
                  className={`rounded-full px-3 py-1.5 ${
                    genMedia === 'video' ? 'bg-slate-800 text-white' : 'text-slate-600'
                  }`}
                  title="Ideogram API does not support video generation yet"
                >
                  Video
                </button>
              </div>
            </div>

            {genMedia === 'video' ? (
              <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
                Ideogram’s public API is <strong>image-only</strong> right now (no video generate
                endpoint). Use <strong>9:16 Story</strong> for vertical stills until Ideogram ships
                video, or upload an MP4 in the Upload section.
              </p>
            ) : (
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                {CREATIVE_SIZE_OPTIONS.map((option) => {
                  const selected = genSize === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setGenSize(option.id)}
                      className={`rounded-xl border px-3 py-2 text-left transition ${
                        selected
                          ? 'border-teal-400 bg-teal-50 ring-1 ring-teal-300'
                          : 'border-slate-200 bg-white hover:border-teal-300'
                      }`}
                    >
                      <div className="text-xs font-semibold text-slate-950">{option.label}</div>
                      <div className="mt-0.5 text-[11px] text-slate-500">{option.hint}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-dashed border-teal-200 bg-teal-50/30 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-950">Reference images</h3>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  Optional. Match brand look (Ideogram style refs) or remix composition (FLUX edit).
                  Up to 4 images.
                </p>
              </div>
              <label className="block text-xs">
                <span className="font-medium text-slate-600">Reference mode</span>
                <select
                  value={referenceMode}
                  onChange={(e) => setReferenceMode(e.target.value as 'style' | 'edit')}
                  className="mt-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-400"
                >
                  <option value="style">Match style (Ideogram)</option>
                  <option value="edit">Remix / edit (FLUX)</option>
                </select>
              </label>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={uploadingRefs || generating || referenceFileIds.length >= 4}
                onClick={() => refInputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-white px-4 py-2 text-sm font-medium text-teal-900 hover:border-teal-400 disabled:opacity-60"
              >
                {uploadingRefs ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Upload references
              </button>
              {referenceFileIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setReferenceFileIds([])}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700"
                >
                  Clear references
                </button>
              )}
              <input
                ref={refInputRef}
                type="file"
                className="hidden"
                multiple
                accept="image/png,image/jpeg,image/webp,image/gif"
                disabled={uploadingRefs || generating}
                onChange={(e) => {
                  void handleUploadReferences(e.target.files);
                  e.target.value = '';
                }}
              />
            </div>

            {referenceFileIds.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {referenceFileIds.map((fileId, index) => (
                  <a
                    key={fileId}
                    href={API_ENDPOINTS.files.download(fileId)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-white px-3 py-1.5 text-xs font-medium text-teal-900"
                  >
                    Ref {index + 1}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        toggleReferenceFile(fileId);
                      }}
                      className="text-slate-400 hover:text-rose-600"
                      aria-label="Remove reference"
                    >
                      ×
                    </button>
                  </a>
                ))}
              </div>
            )}

            {assets.some((a) => a.fileIds[0]) && (
              <div className="mt-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Or pick from campaign assets
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {assets
                    .filter((a) => a.fileIds[0])
                    .slice(0, 12)
                    .map((asset) => {
                      const fileId = asset.fileIds[0];
                      const selected = referenceFileIds.includes(fileId);
                      return (
                        <button
                          key={asset.id}
                          type="button"
                          onClick={() => toggleReferenceFile(fileId)}
                          className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 ${
                            selected
                              ? 'bg-teal-600 text-white ring-teal-600'
                              : 'bg-white text-slate-700 ring-slate-200 hover:ring-teal-300'
                          }`}
                        >
                          {selected ? '✓ ' : ''}
                          {asset.title.slice(0, 28)}
                          {asset.title.length > 28 ? '…' : ''}
                        </button>
                      );
                    })}
                </div>
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block text-sm sm:col-span-2 lg:col-span-1">
              <span className="text-xs font-medium text-slate-600">Title</span>
              <input
                value={genTitle}
                onChange={(e) => setGenTitle(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-400"
                placeholder="Asset title"
              />
            </label>
            <label className="block text-sm">
              <span className="text-xs font-medium text-slate-600">Style</span>
              <select
                value={genStyle}
                onChange={(e) => {
                  const next = e.target.value as ImageGenerationStyle;
                  setGenStyle(next);
                  setGenSize(defaultSizeForStyle(next));
                }}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-400"
              >
                {STYLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-xs font-medium text-slate-600">Quality</span>
              <select
                value={genQuality}
                onChange={(e) => setGenQuality(e.target.value as ImageGenerationQuality)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-400"
              >
                {QUALITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-xs font-medium text-slate-600">Provider</span>
              <select
                value={genProvider}
                onChange={(e) => setGenProvider(e.target.value as ProviderChoice)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-400"
              >
                <option value="auto">Auto (poster → Ideogram)</option>
                <option value="ideogram">Ideogram</option>
                <option value="flux">FLUX (BFL)</option>
              </select>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={generating || uploading}
              className="inline-flex items-center gap-2 rounded-full bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-500 disabled:opacity-60"
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {generating ? 'Generating…' : 'Generate creative'}
            </button>
            <button
              type="button"
              onClick={() =>
                setGenPrompt(buildDefaultPrompt(programId, programName, selectedCampaign))
              }
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-teal-300"
            >
              Reset prompt from intent
            </button>
            {campaigns.length === 0 && (
              <p className="text-xs text-slate-500">
                No campaign yet — first generate creates a Registration campaign for {programName}.
              </p>
            )}
          </div>
        </form>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-950">Upload creatives</h2>
        <p className="mt-1 text-sm text-slate-600">
          Or drop Canva/Figma exports, images, and video under the same campaign.
        </p>

        {/* Always-visible dropzone — primary upload surface */}
        <div
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          onClick={() => !uploading && !generating && fileInputRef.current?.click()}
          onDragEnter={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setDragOver(false);
          }}
          onDrop={onDrop}
          className={`mt-5 flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-8 text-center transition ${
            dragOver
              ? 'border-teal-500 bg-teal-50'
              : 'border-slate-200 bg-slate-50/60 hover:border-teal-400 hover:bg-teal-50/40'
          } ${uploading || generating ? 'pointer-events-none opacity-70' : ''}`}
        >
          {uploading ? (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-teal-700" />
              <p className="mt-3 text-sm font-semibold text-teal-900">Uploading…</p>
            </>
          ) : (
            <>
              <Upload className="h-8 w-8 text-slate-500" />
              <p className="mt-3 text-sm font-semibold text-slate-950">
                Drop files here or click to upload
              </p>
              <p className="mt-1 text-xs text-slate-500">PNG, JPG, WebP, GIF, PDF, MP4</p>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            multiple
            accept="image/*,video/*,.pdf,.png,.jpg,.jpeg,.webp,.gif,.mp4,.mov"
            disabled={uploading || generating}
            onChange={(e) => {
              void handleUpload(e.target.files);
              e.target.value = '';
            }}
          />
        </div>

        {campaigns.length === 0 && (
          <p className="mt-3 text-xs text-slate-500">
            No campaign yet — first upload will create a Registration campaign for {programName}.{' '}
            <button
              type="button"
              onClick={onGoToCampaigns}
              className="font-semibold text-teal-800 underline-offset-2 hover:underline"
            >
              Or create one manually
            </button>
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowProjectForm((v) => !v)}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-teal-300"
          >
            <FolderPlus className="h-4 w-4" />
            New creative project
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || generating}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-teal-300 disabled:opacity-60"
          >
            <Upload className="h-4 w-4" />
            Upload assets
          </button>
        </div>

        {showProjectForm && (
          <form
            onSubmit={handleCreateProject}
            className="mt-4 rounded-2xl border border-teal-200 bg-teal-50/40 p-4"
          >
            <label className="block text-sm">
              <span className="text-xs font-medium text-slate-600">Project name</span>
              <input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-400"
                placeholder="e.g. Registration Launch"
                required
              />
            </label>
            <div className="mt-3 flex gap-2">
              <button
                type="submit"
                disabled={savingProject}
                className="inline-flex items-center gap-2 rounded-full bg-teal-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {savingProject ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Create
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowProjectForm(false);
                  setProjectName('');
                }}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {projects.length > 0 && (
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-950">Creative projects</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {projects.map((project) => {
              const count = assets.filter((a) => a.creativeProjectId === project.id).length;
              const active = projectId === project.id;
              return (
                <div
                  key={project.id}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${
                    active
                      ? 'border-teal-300 bg-teal-50 text-teal-900'
                      : 'border-slate-200 bg-slate-50 text-slate-700'
                  }`}
                >
                  <button type="button" onClick={() => setProjectId(project.id)}>
                    {project.name} · {count}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteProject(project)}
                    className="text-slate-400 hover:text-rose-600"
                    aria-label={`Delete ${project.name}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-950">Uploaded assets</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block text-xs">
              <span className="font-medium text-slate-600">Publish channel</span>
              <select
                value={publishChannel}
                onChange={(e) => setPublishChannel(e.target.value as ChannelKind)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-400"
              >
                {CHANNEL_OPTIONS.map((option) => (
                  <option key={option.kind} value={option.kind}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            {publishChannel === 'whatsapp' && (
              <label className="block text-xs">
                <span className="font-medium text-slate-600">WhatsApp recipient (for live send)</span>
                <input
                  value={recipientPhone}
                  onChange={(e) => setRecipientPhone(e.target.value)}
                  placeholder="9198XXXXXXXX"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-400"
                />
              </label>
            )}
            <label className="block text-xs sm:col-span-2 lg:col-span-1">
              <span className="font-medium text-slate-600">Message / caption (optional)</span>
              <input
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                placeholder="Caption sent with the publish"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-400"
              />
            </label>
          </div>
        </div>
        {loading ? (
          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading assets…
          </div>
        ) : visibleAssets.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">
            No assets yet — generate a flyer above or upload a file.
          </p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visibleAssets.map((asset) => {
              const project = projects.find((p) => p.id === asset.creativeProjectId);
              const fileId = asset.fileIds[0];
              const busy = publishingAssetId === asset.id;
              const provider =
                typeof asset.metadata?.provider === 'string' ? asset.metadata.provider : null;
              const generated = asset.metadata?.generatedBy === 'creative_ai';
              return (
                <div
                  key={asset.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-slate-950">{asset.title}</div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        {asset.kind}
                        {project ? ` · ${project.name}` : ''}
                        {generated && provider ? ` · AI · ${provider}` : ''}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 ring-1 ring-slate-200">
                      {asset.status}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {fileId && (
                      <a
                        href={API_ENDPOINTS.files.download(fileId)}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-teal-800 hover:border-teal-300"
                      >
                        Open file
                      </a>
                    )}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handlePublish(asset)}
                      className="inline-flex items-center gap-1 rounded-lg bg-teal-600 px-2 py-1 text-xs font-semibold text-white hover:bg-teal-500 disabled:opacity-60"
                    >
                      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                      Publish
                    </button>
                    {fileId && (
                      <button
                        type="button"
                        onClick={() => toggleReferenceFile(fileId)}
                        className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium ${
                          referenceFileIds.includes(fileId)
                            ? 'border-teal-300 bg-teal-50 text-teal-900'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-teal-300'
                        }`}
                      >
                        <Sparkles className="h-3 w-3" />
                        {referenceFileIds.includes(fileId) ? 'Reference on' : 'Use as reference'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleDeleteAsset(asset)}
                      className="inline-flex items-center gap-1 rounded-lg border border-rose-100 bg-white px-2 py-1 text-xs font-medium text-rose-700 hover:border-rose-300"
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
    </section>
  );
}
