import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type FormEvent } from 'react';
import { FolderPlus, Loader2, Plus, Send, Sparkles, Trash2, Upload, Download, Copy, Eye } from 'lucide-react';
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
import {
  downloadAuthenticatedFile,
  extensionForMime,
  fetchAuthenticatedBlob,
  safeDownloadFilename,
} from '../../utils/downloadFile';
import { showError, showSuccess } from '../../utils/toast';
import { CHANNEL_OPTIONS } from './PublishingPanel';

function kindFromFile(file: File): GrowthAssetKind {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  return 'other';
}

function AssetImagePreview({
  fileId,
  title,
  transparent,
  onOpen,
}: {
  fileId: string;
  title: string;
  transparent?: boolean;
  onOpen?: () => void;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let revoked: string | null = null;
    let cancelled = false;
    setFailed(false);
    setSrc(null);
    void (async () => {
      try {
        const blob = await fetchAuthenticatedBlob(API_ENDPOINTS.files.download(fileId));
        if (cancelled) return;
        if (!blob.type.startsWith('image/')) {
          setFailed(true);
          return;
        }
        const url = URL.createObjectURL(blob);
        revoked = url;
        setSrc(url);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [fileId]);

  if (failed) {
    return (
      <div className="flex aspect-[4/5] items-center justify-center rounded-xl bg-slate-100 text-xs text-slate-500">
        Preview unavailable — use Download
      </div>
    );
  }

  if (!src) {
    return (
      <div className="flex aspect-[4/5] items-center justify-center rounded-xl bg-slate-100 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`group relative block w-full overflow-hidden rounded-xl ring-1 ring-slate-200 transition hover:ring-teal-300 ${
        transparent
          ? 'bg-[linear-gradient(45deg,#e2e8f0_25%,transparent_25%),linear-gradient(-45deg,#e2e8f0_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#e2e8f0_75%),linear-gradient(-45deg,transparent_75%,#e2e8f0_75%)] bg-[length:16px_16px] bg-[position:0_0,0_8px,8px_-8px,-8px_0] bg-white'
          : 'bg-slate-100'
      }`}
      title="Open preview"
    >
      <div className="flex aspect-[4/5] items-center justify-center p-2">
        <img
          src={src}
          alt={title}
          className="max-h-full max-w-full object-contain"
        />
      </div>
      <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/50 to-transparent px-3 py-2 text-left text-[11px] font-medium text-white opacity-0 transition group-hover:opacity-100">
        Click to open full size
      </span>
    </button>
  );
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

type SessionReference = {
  localId: string;
  name: string;
  contentType: string;
  base64: string;
  fileId?: string;
};

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const base64 = result.includes(',') ? result.split(',')[1] || '' : result;
      if (!base64) reject(new Error(`Could not read ${file.name}`));
      else resolve(base64);
    };
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

function buildDefaultPrompt(
  programId: string,
  programName: string,
  campaign?: AcquisitionCampaign | null,
  style: ImageGenerationStyle = 'marketing_poster',
): string {
  const intent = campaign?.intentId
    ? getIntentById(programId, campaign.intentId)
    : undefined;
  const cta = intent?.cta || 'Learn more';
  const purpose = intent?.purpose || 'Acquire program interest from the market';
  const intentLabel = intent?.name || 'Registration';

  const styleLine: Record<ImageGenerationStyle, string> = {
    marketing_poster:
      'Clean modern institutional flyer, high contrast, ample negative space, print-ready, no clutter, no fake logos.',
    social_media:
      'Mobile-first social card, bold short copy, high contrast, safe margins, single clear message.',
    hero_banner:
      'Wide cinematic hero banner with space for headline, premium institutional brand feel, restrained copy.',
    infographic:
      'Structured infographic layout with clear sections and readable labels, not photoreal clutter.',
    illustration:
      'Cohesive illustrated style (not photo), intentional shapes, polished editorial palette.',
    photo_realistic:
      'Photoreal scene with natural lighting and sharp focus; no cartoon styling or fake UI overlays.',
    logo: 'Simple flat logo mark or wordmark, centered, high contrast, minimal detail, empty background.',
    product_mockup: 'Clean product mockup, soft studio lighting, uncluttered surface.',
    other: 'Clean professional creative, deliberate composition, high visual quality.',
  };

  return [
    `Professional ${style.replace(/_/g, ' ')} creative for "${programName}".`,
    `Growth intent: ${intentLabel} — ${purpose}.`,
    `Clear headline with program name, short supporting line, and CTA "${cta}".`,
    styleLine[style] || styleLine.marketing_poster,
  ].join(' ');
}

const PALETTE_PRESETS: { id: string; label: string; primary: string; secondary: string; accent: string }[] = [
  { id: 'navy-gold', label: 'Navy & gold', primary: '#0B2C5E', secondary: '#C4A35A', accent: '#F5F7FA' },
  { id: 'teal-slate', label: 'Teal & slate', primary: '#0F766E', secondary: '#334155', accent: '#E2E8F0' },
  { id: 'forest-cream', label: 'Forest & cream', primary: '#1B4332', secondary: '#D8E2DC', accent: '#F8F1E7' },
  { id: 'burgundy-sand', label: 'Burgundy & sand', primary: '#7A1F2B', secondary: '#E6D5B8', accent: '#F7F3EE' },
];

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const hex = /^#[0-9A-Fa-f]{6}$/.test(value) ? value : '#64748B';
  return (
    <label className="block text-sm">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="color"
          value={hex}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-9 w-10 cursor-pointer rounded border border-slate-200 bg-white p-1"
          aria-label={label}
        />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#0B2C5E"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-400"
        />
      </div>
    </label>
  );
}

function briefDefaults(
  programId: string,
  programName: string,
  campaign?: AcquisitionCampaign | null,
): { headline: string; cta: string; mustIncludeText: string; avoid: string } {
  const intent = campaign?.intentId
    ? getIntentById(programId, campaign.intentId)
    : undefined;
  return {
    headline: programName,
    cta: intent?.cta || 'Learn more',
    mustIncludeText: programName,
    avoid: 'fake logos, watermarks, unreadable text, clutter',
  };
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
  const [genQuality, setGenQuality] = useState<ImageGenerationQuality>('premium');
  const [genProvider, setGenProvider] = useState<ProviderChoice>('auto');
  const [genSize, setGenSize] = useState<CreativeSizeId>('3x4');
  const [genMedia, setGenMedia] = useState<'image' | 'video'>('image');
  const [transparentBackground, setTransparentBackground] = useState(false);
  const [variantCount, setVariantCount] = useState(1);
  const [briefHeadline, setBriefHeadline] = useState('');
  const [briefCta, setBriefCta] = useState('');
  const [briefMustInclude, setBriefMustInclude] = useState('');
  const [briefAvoid, setBriefAvoid] = useState('fake logos, watermarks, unreadable text, clutter');
  const [primaryColor, setPrimaryColor] = useState('');
  const [secondaryColor, setSecondaryColor] = useState('');
  const [accentColor, setAccentColor] = useState('');
  const [useLogoReference, setUseLogoReference] = useState(true);
  const [analyzeReferences, setAnalyzeReferences] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ src: string; title: string } | null>(null);
  const [sessionRefs, setSessionRefs] = useState<SessionReference[]>([]);
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
    // Prefill prompt + brief when campaign/program changes and user hasn't customized yet
    setGenPrompt((current) => {
      if (current.trim().length > 0 && !current.includes(programName)) {
        return current;
      }
      return buildDefaultPrompt(programId, programName, selectedCampaign, genStyle);
    });
    const defaults = briefDefaults(programId, programName, selectedCampaign);
    setBriefHeadline((current) => (current.trim() ? current : defaults.headline));
    setBriefCta((current) => (current.trim() ? current : defaults.cta));
    setBriefMustInclude((current) => (current.trim() ? current : defaults.mustIncludeText));
    setBriefAvoid((current) => (current.trim() ? current : defaults.avoid));
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
          referenceImages: sessionRefs.length
            ? sessionRefs.map((ref) => ({
                filename: ref.name,
                contentType: ref.contentType,
                base64: ref.base64,
              }))
            : undefined,
          referenceMode: sessionRefs.length ? referenceMode : undefined,
          transparentBackground: transparentBackground || undefined,
          variantCount,
          precision: {
            institutionName: programName,
            headline: briefHeadline.trim() || undefined,
            cta: briefCta.trim() || undefined,
            mustIncludeText: briefMustInclude.trim() || undefined,
            avoid: briefAvoid.trim() || undefined,
            primaryColor: primaryColor.trim() || undefined,
            secondaryColor: secondaryColor.trim() || undefined,
            accentColor: accentColor.trim() || undefined,
            useLogoReference: sessionRefs.length > 0 ? useLogoReference : undefined,
          },
          analyzeReferences:
            sessionRefs.length > 0 ? analyzeReferences : undefined,
          kind:
            transparentBackground
              ? 'image'
              : genStyle === 'marketing_poster' || genStyle === 'infographic'
                ? 'poster'
                : genStyle === 'hero_banner'
                  ? 'landing_hero'
                  : 'image',
        },
      );

      const count = Array.isArray((res.data as { assets?: unknown[] }).assets)
        ? (res.data as { assets: unknown[] }).assets.length
        : 1;
      showSuccess(
        count > 1
          ? `${count} creatives generated with ${res.data.provider}`
          : `Creative generated with ${res.data.provider} (${res.data.modelId})`,
      );
      await load(targetCampaignId);
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const removeSessionRef = (localId: string) => {
    setSessionRefs((current) => current.filter((ref) => ref.localId !== localId));
  };

  const addSessionRefFromFile = async (file: File) => {
    const base64 = await readFileAsBase64(file);
    let fileId: string | undefined;
    try {
      const uploaded = await apiClient.uploadFile<{
        fileId?: string;
        id?: string;
        storageKey?: string;
      }>(API_ENDPOINTS.files.upload, file, { storeOriginal: true });
      fileId = uploaded.fileId || uploaded.id;
    } catch {
      // Inline base64 is enough for generate; upload is best-effort persistence.
    }
    setSessionRefs((current) => {
      if (current.length >= 4) return current;
      return [
        ...current,
        {
          localId: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: file.name,
          contentType: file.type || 'image/png',
          base64,
          fileId,
        },
      ];
    });
  };

  const handleUploadReferences = async (fileList: FileList | File[] | null) => {
    const files = fileList ? Array.from(fileList) : [];
    if (!files.length) return;
    const room = 4 - sessionRefs.length;
    if (room <= 0) {
      showError('You can attach up to 4 reference images');
      return;
    }

    setUploadingRefs(true);
    try {
      let added = 0;
      for (const file of files.slice(0, room)) {
        if (!file.type.startsWith('image/')) {
          showError(`${file.name} is not an image`);
          continue;
        }
        await addSessionRefFromFile(file);
        added += 1;
      }
      showSuccess(added ? `Added ${added} reference image(s)` : 'No new references added');
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Reference upload failed');
    } finally {
      setUploadingRefs(false);
    }
  };

  const handleUseAssetAsReference = async (asset: GrowthMarketingAsset) => {
    const fileId = asset.fileIds[0];
    if (!fileId) return;
    if (sessionRefs.length >= 4) {
      showError('You can attach up to 4 reference images');
      return;
    }
    if (sessionRefs.some((ref) => ref.fileId === fileId)) {
      setSessionRefs((current) => current.filter((ref) => ref.fileId !== fileId));
      return;
    }
    setUploadingRefs(true);
    try {
      const blob = await fetchAuthenticatedBlob(API_ENDPOINTS.files.download(fileId));
      if (!blob.type.startsWith('image/')) {
        throw new Error('Asset is not an image');
      }
      const buffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);
      setSessionRefs((current) => [
        ...current,
        {
          localId: `asset-${fileId}`,
          name: asset.title || 'reference.png',
          contentType: blob.type || 'image/png',
          base64,
          fileId,
        },
      ]);
      showSuccess('Reference attached');
    } catch {
      showError(
        'This asset has no stored image bytes. Clear references and use Upload references with your logo file instead.',
      );
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
          { storeOriginal: true },
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

  const handleDownloadAsset = async (asset: GrowthMarketingAsset) => {
    const fileId = asset.fileIds[0];
    if (!fileId) return;
    setDownloadingId(asset.id);
    try {
      const transparent = asset.metadata?.transparentBackground === true;
      const ext = transparent ? 'png' : extensionForMime('image/png');
      await downloadAuthenticatedFile({
        url: API_ENDPOINTS.files.download(fileId),
        filename: safeDownloadFilename(asset.title, ext),
      });
      showSuccess('Download started');
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Download failed');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleOpenAsset = async (asset: GrowthMarketingAsset) => {
    const fileId = asset.fileIds[0];
    if (!fileId) return;
    setOpeningId(asset.id);
    try {
      const blob = await fetchAuthenticatedBlob(API_ENDPOINTS.files.download(fileId));
      const src = URL.createObjectURL(blob);
      if (blob.type.startsWith('image/')) {
        setLightbox({ src, title: asset.title });
      } else {
        const opened = window.open(src, '_blank', 'noopener,noreferrer');
        if (!opened) {
          window.location.assign(src);
        } else {
          window.setTimeout(() => URL.revokeObjectURL(src), 60_000);
        }
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Could not open file');
    } finally {
      setOpeningId(null);
    }
  };

  const handleCopyPrompt = async (asset: GrowthMarketingAsset) => {
    const prompt = typeof asset.metadata?.prompt === 'string' ? asset.metadata.prompt : '';
    if (!prompt) {
      showError('No prompt stored on this asset');
      return;
    }
    try {
      await navigator.clipboard.writeText(prompt);
      showSuccess('Prompt copied');
    } catch {
      showError('Could not copy prompt');
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
            <span className="mt-1 block text-[11px] text-slate-500">
              Tip: fill the brief below so exact headline / CTA text stays sharp. Backend also
              adds style guidance and avoid-rules automatically.
            </span>
          </label>

          <div className="rounded-2xl border border-teal-200 bg-teal-50/40 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-950">Creative brief (precision)</h3>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  Exact copy the model must render. Leave blank to rely on the free-form prompt only.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const defaults = briefDefaults(programId, programName, selectedCampaign);
                  setBriefHeadline(defaults.headline);
                  setBriefCta(defaults.cta);
                  setBriefMustInclude(defaults.mustIncludeText);
                  setBriefAvoid(defaults.avoid);
                }}
                className="rounded-full border border-teal-200 bg-white px-3 py-1.5 text-xs font-medium text-teal-900 hover:border-teal-400"
              >
                Prefill from program
              </button>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="text-xs font-medium text-slate-600">Headline (exact)</span>
                <input
                  value={briefHeadline}
                  onChange={(e) => setBriefHeadline(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-400"
                  placeholder={programName}
                />
              </label>
              <label className="block text-sm">
                <span className="text-xs font-medium text-slate-600">CTA (exact)</span>
                <input
                  value={briefCta}
                  onChange={(e) => setBriefCta(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-400"
                  placeholder="Apply now"
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="text-xs font-medium text-slate-600">
                  Must include (exact text, dates, city…)
                </span>
                <textarea
                  value={briefMustInclude}
                  onChange={(e) => setBriefMustInclude(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-400"
                  placeholder="Program name, intake date, campus…"
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="text-xs font-medium text-slate-600">Avoid</span>
                <input
                  value={briefAvoid}
                  onChange={(e) => setBriefAvoid(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-400"
                  placeholder="fake logos, watermarks…"
                />
              </label>
            </div>

            <div className="mt-4 border-t border-teal-100 pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Brand palette & logo
                </h4>
                <button
                  type="button"
                  onClick={() => {
                    setPrimaryColor('');
                    setSecondaryColor('');
                    setAccentColor('');
                  }}
                  className="text-[11px] font-medium text-slate-500 hover:text-teal-800"
                >
                  Clear colors
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {PALETTE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setPrimaryColor(preset.primary);
                      setSecondaryColor(preset.secondary);
                      setAccentColor(preset.accent);
                    }}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-teal-300"
                  >
                    <span
                      className="inline-flex h-3.5 overflow-hidden rounded-full ring-1 ring-slate-200"
                      aria-hidden
                    >
                      <span className="h-3.5 w-3.5" style={{ background: preset.primary }} />
                      <span className="h-3.5 w-3.5" style={{ background: preset.secondary }} />
                      <span className="h-3.5 w-3.5" style={{ background: preset.accent }} />
                    </span>
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <ColorField label="Primary" value={primaryColor} onChange={setPrimaryColor} />
                <ColorField label="Secondary" value={secondaryColor} onChange={setSecondaryColor} />
                <ColorField label="Accent" value={accentColor} onChange={setAccentColor} />
              </div>
              <p className="mt-2 text-[11px] text-slate-500">
                Colors go into the prompt and Ideogram’s color palette. Leave empty to let vision
                infer colors from references when available.
              </p>
            </div>
          </div>

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
                disabled={uploadingRefs || generating || sessionRefs.length >= 4}
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
              {sessionRefs.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSessionRefs([])}
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

            <p className="mt-2 text-[11px] text-slate-500">
              Tip: always use <strong>Upload references</strong> for logos. Older campaign assets may
              not have stored image bytes.
            </p>

            {sessionRefs.length > 0 && (
              <div className="mt-3 space-y-2 rounded-xl border border-teal-100 bg-white/80 px-3 py-3">
                <label className="flex items-start gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={analyzeReferences}
                    onChange={(e) => setAnalyzeReferences(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="font-medium text-slate-950">
                      Analyze references with vision
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      Uses Groq vision to describe colors, style, and logo cues, then updates the
                      generate prompt behind the scenes.
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={useLogoReference}
                    onChange={(e) => setUseLogoReference(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="font-medium text-slate-950">
                      Treat first reference as official logo
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      Instructs the model to place the real mark instead of inventing a seal.
                    </span>
                  </span>
                </label>
              </div>
            )}

            {sessionRefs.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {sessionRefs.map((ref, index) => (
                  <span
                    key={ref.localId}
                    className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-white px-3 py-1.5 text-xs font-medium text-teal-900"
                  >
                    Ref {index + 1}: {ref.name.slice(0, 24)}
                    {ref.name.length > 24 ? '…' : ''}
                    <button
                      type="button"
                      onClick={() => removeSessionRef(ref.localId)}
                      className="text-slate-400 hover:text-rose-600"
                      aria-label="Remove reference"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            {assets.some((a) => a.fileIds[0]) && (
              <div className="mt-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Or try campaign assets (only if bytes are stored)
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {assets
                    .filter((a) => a.fileIds[0])
                    .slice(0, 12)
                    .map((asset) => {
                      const fileId = asset.fileIds[0];
                      const selected = sessionRefs.some((ref) => ref.fileId === fileId);
                      return (
                        <button
                          key={asset.id}
                          type="button"
                          onClick={() => void handleUseAssetAsReference(asset)}
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
                  setGenPrompt(buildDefaultPrompt(programId, programName, selectedCampaign, next));
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
              <span className="mt-1 block text-[11px] text-slate-500">
                Premium uses Ideogram QUALITY / larger FLUX size.
              </span>
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
            <label className="block text-sm">
              <span className="text-xs font-medium text-slate-600">Variants</span>
              <select
                value={variantCount}
                onChange={(e) => setVariantCount(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-400"
              >
                <option value={1}>1 image</option>
                <option value={2}>2 variants</option>
                <option value={3}>3 variants</option>
                <option value={4}>4 variants</option>
              </select>
            </label>
          </div>

          <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm">
            <input
              type="checkbox"
              checked={transparentBackground}
              onChange={(e) => {
                setTransparentBackground(e.target.checked);
                if (e.target.checked) setGenProvider('ideogram');
              }}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium text-slate-950">Transparent PNG (Ideogram)</span>
              <span className="mt-0.5 block text-xs text-slate-500">
                Best for logos, stickers, and overlays. Uses Ideogram’s transparent generate endpoint.
              </span>
            </span>
          </label>

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
              onClick={() => {
                setGenPrompt(
                  buildDefaultPrompt(programId, programName, selectedCampaign, genStyle),
                );
                const defaults = briefDefaults(programId, programName, selectedCampaign);
                setBriefHeadline(defaults.headline);
                setBriefCta(defaults.cta);
                setBriefMustInclude(defaults.mustIncludeText);
                setBriefAvoid(defaults.avoid);
              }}
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
                  {fileId && (
                    <div className="mb-3">
                      <AssetImagePreview
                        fileId={fileId}
                        title={asset.title}
                        transparent={asset.metadata?.transparentBackground === true}
                        onOpen={() => void handleOpenAsset(asset)}
                      />
                    </div>
                  )}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-slate-950">{asset.title}</div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        {asset.kind}
                        {project ? ` · ${project.name}` : ''}
                        {generated && provider ? ` · AI · ${provider}` : ''}
                        {asset.metadata?.transparentBackground === true ? ' · transparent' : ''}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 ring-1 ring-slate-200">
                      {asset.status}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {fileId && (
                      <>
                        <button
                          type="button"
                          disabled={downloadingId === asset.id}
                          onClick={() => void handleDownloadAsset(asset)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-teal-800 hover:border-teal-300 disabled:opacity-60"
                        >
                          {downloadingId === asset.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Download className="h-3 w-3" />
                          )}
                          Download
                        </button>
                        <button
                          type="button"
                          disabled={openingId === asset.id}
                          onClick={() => void handleOpenAsset(asset)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:border-teal-300 disabled:opacity-60"
                        >
                          {openingId === asset.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Eye className="h-3 w-3" />
                          )}
                          Open
                        </button>
                      </>
                    )}
                    {generated && (
                      <button
                        type="button"
                        onClick={() => void handleCopyPrompt(asset)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:border-teal-300"
                      >
                        <Copy className="h-3 w-3" />
                        Copy prompt
                      </button>
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
                        onClick={() => void handleUseAssetAsReference(asset)}
                        className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium ${
                          sessionRefs.some((ref) => ref.fileId === fileId)
                            ? 'border-teal-300 bg-teal-50 text-teal-900'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-teal-300'
                        }`}
                      >
                        <Sparkles className="h-3 w-3" />
                        {sessionRefs.some((ref) => ref.fileId === fileId)
                          ? 'Reference on'
                          : 'Use as reference'}
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

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={lightbox.title}
          onClick={() => {
            URL.revokeObjectURL(lightbox.src);
            setLightbox(null);
          }}
        >
          <div
            className="relative max-h-[90vh] max-w-5xl overflow-auto rounded-2xl bg-white p-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="truncate text-sm font-semibold text-slate-950">{lightbox.title}</div>
              <button
                type="button"
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:border-teal-300"
                onClick={() => {
                  URL.revokeObjectURL(lightbox.src);
                  setLightbox(null);
                }}
              >
                Close
              </button>
            </div>
            <div className="rounded-xl bg-[linear-gradient(45deg,#e2e8f0_25%,transparent_25%),linear-gradient(-45deg,#e2e8f0_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#e2e8f0_75%),linear-gradient(-45deg,transparent_75%,#e2e8f0_75%)] bg-[length:20px_20px] bg-[position:0_0,0_10px,10px_-10px,-10px_0] bg-white p-2">
              <img
                src={lightbox.src}
                alt={lightbox.title}
                className="mx-auto max-h-[78vh] max-w-full object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
