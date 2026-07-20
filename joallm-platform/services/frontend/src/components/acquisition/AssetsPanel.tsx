import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { FolderPlus, Loader2, Plus, Trash2, Upload } from 'lucide-react';
import type {
  AcquisitionCampaign,
  CreativeProject,
  GrowthAssetKind,
  GrowthMarketingAsset,
} from '@joallm/shared';
import { API_ENDPOINTS } from '../../config/api';
import { apiClient } from '../../utils/api-client';
import { showError, showSuccess } from '../../utils/toast';

function kindFromFile(file: File): GrowthAssetKind {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  return 'other';
}

export function AssetsPanel({
  programId,
  campaigns,
  campaignsLoading,
}: {
  programId: string;
  campaigns: AcquisitionCampaign[];
  campaignsLoading: boolean;
}) {
  const [campaignId, setCampaignId] = useState('');
  const [projects, setProjects] = useState<CreativeProject[]>([]);
  const [assets, setAssets] = useState<GrowthMarketingAsset[]>([]);
  const [projectId, setProjectId] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [savingProject, setSavingProject] = useState(false);

  useEffect(() => {
    if (!campaignId && campaigns[0]) {
      setCampaignId(campaigns[0].id);
    }
  }, [campaigns, campaignId]);

  const load = useCallback(async () => {
    if (!campaignId) {
      setProjects([]);
      setAssets([]);
      return;
    }
    setLoading(true);
    try {
      const base = `/api/acquisition/programs/${encodeURIComponent(programId)}/campaigns/${campaignId}`;
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

  const handleCreateProject = async (event: FormEvent) => {
    event.preventDefault();
    if (!campaignId || !projectName.trim()) return;
    setSavingProject(true);
    try {
      const res = await apiClient.post<{ success: boolean; data: CreativeProject }>(
        `/api/acquisition/programs/${encodeURIComponent(programId)}/campaigns/${campaignId}/creative-projects`,
        { name: projectName.trim(), status: 'active' },
      );
      showSuccess('Creative project created');
      setProjectName('');
      setShowProjectForm(false);
      setProjectId(res.data.id);
      await load();
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to create project');
    } finally {
      setSavingProject(false);
    }
  };

  const handleUpload = async (fileList: FileList | null) => {
    if (!fileList?.length || !campaignId) return;
    setUploading(true);
    try {
      let targetProjectId = projectId;
      if (!targetProjectId) {
        const existing = projects[0];
        if (existing) {
          targetProjectId = existing.id;
        } else {
          const created = await apiClient.post<{ success: boolean; data: CreativeProject }>(
            `/api/acquisition/programs/${encodeURIComponent(programId)}/campaigns/${campaignId}/creative-projects`,
            { name: 'Default creatives', status: 'active' },
          );
          targetProjectId = created.data.id;
        }
        setProjectId(targetProjectId);
      }

      for (const file of Array.from(fileList)) {
        const uploaded = await apiClient.uploadFile<{ fileId?: string; id?: string }>(
          API_ENDPOINTS.files.upload,
          file,
        );
        const fileId = uploaded.fileId || uploaded.id;
        if (!fileId) {
          throw new Error(`Upload failed for ${file.name}`);
        }
        await apiClient.post(
          `/api/acquisition/programs/${encodeURIComponent(programId)}/campaigns/${campaignId}/creative-projects/${targetProjectId}/assets`,
          {
            title: file.name.replace(/\.[^.]+$/, '') || file.name,
            kind: kindFromFile(file),
            fileIds: [fileId],
            status: 'draft',
          },
        );
      }
      showSuccess(fileList.length === 1 ? 'Asset uploaded' : `${fileList.length} assets uploaded`);
      await load();
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAsset = async (asset: GrowthMarketingAsset) => {
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

  if (campaigns.length === 0) {
    return (
      <section className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-6">
        <h2 className="text-xl font-semibold text-slate-950">Assets</h2>
        <p className="mt-2 text-sm text-slate-600">
          Create a Campaign under an Intent first — assets attach to a Creative Project under that
          campaign.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">Creative Projects & Assets</h2>
            <p className="mt-1 text-sm text-slate-600">
              Upload posters, Canva/Figma exports, and creatives under a campaign. AI generate is
              postponed — manual attach validates the architecture.
            </p>
          </div>
          <label className="btn-atrisi-primary inline-flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-sm disabled:opacity-60">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploading ? 'Uploading…' : 'Upload assets'}
            <input
              type="file"
              className="hidden"
              multiple
              accept="image/*,video/*,.pdf,.png,.jpg,.jpeg,.webp,.gif,.mp4,.mov"
              disabled={!campaignId || uploading}
              onChange={(e) => {
                void handleUpload(e.target.files);
                e.target.value = '';
              }}
            />
          </label>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
            <span className="text-xs font-medium text-slate-600">Creative project (filter)</span>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-400"
            >
              <option value="">All projects</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowProjectForm((v) => !v)}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-teal-300"
          >
            <FolderPlus className="h-4 w-4" />
            New creative project
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
                className="btn-atrisi-primary inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm disabled:opacity-60"
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
        <h3 className="text-sm font-semibold text-slate-950">Assets</h3>
        {loading ? (
          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading assets…
          </div>
        ) : visibleAssets.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">
            No assets yet. Upload a poster or export to attach it under this campaign.
          </p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visibleAssets.map((asset) => {
              const project = projects.find((p) => p.id === asset.creativeProjectId);
              const fileId = asset.fileIds[0];
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
