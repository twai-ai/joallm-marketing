import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { AuthPreviewImage } from '../components/story/AuthPreviewImage';
import { useDocuments } from '../hooks/useDocuments';
import { useStorySession } from '../hooks/useStory';
import type { StoryBeat, StoryFormatId } from '../types/story';
import { STORY_FORMAT_OPTIONS } from '../types/story';
import { showError } from '../utils/toast';

const ARC_LABEL: Record<string, string> = {
  context: 'Context',
  proof: 'Proof',
  ask: 'Ask',
  other: '',
};

export function StorySessionPage() {
  const { storyId } = useParams<{ storyId: string }>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const styleInputRef = useRef<HTMLInputElement>(null);
  const {
    story,
    isLoading,
    saveStory,
    isSaving,
    addFiles,
    isAddingFiles,
    proposeStoryline,
    isProposing,
    brandBeat,
    isBranding,
    generateSimilar,
    isGeneratingSimilar,
    saveBrandKit,
    isSavingBrandKit,
    brandKit,
    format,
    exportStory,
  } = useStorySession(storyId);
  const { uploadMultiple, isUploading } = useDocuments();

  const [beats, setBeats] = useState<StoryBeat[]>([]);
  const [title, setTitle] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [dragId, setDragId] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (!story) return;
    setTitle(story.title);
    setBeats(story.beats);
    if (!selectedId && story.beats[0]) {
      setSelectedId(story.beats[0].id);
    }
  }, [story, selectedId]);

  const selected = useMemo(
    () => beats.find((b) => b.id === selectedId) || beats[0] || null,
    [beats, selectedId],
  );

  const persistBeats = async (next: StoryBeat[]) => {
    setBeats(next);
    await saveStory({ beats: next.map((b, order) => ({ ...b, order })) });
  };

  const extractFileIds = (uploaded: unknown[]) =>
    uploaded
      .map((f) => (f as { id?: string; fileId?: string }).id || (f as { fileId?: string }).fileId)
      .filter(Boolean) as string[];

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length || !storyId) return;
    try {
      const uploaded = await uploadMultiple(Array.from(files), true);
      const fileIds = extractFileIds(uploaded);
      if (fileIds.length === 0) {
        showError('Upload finished but no file ids returned');
        return;
      }
      await addFiles(fileIds);
    } catch {
      showError('Upload failed');
    }
  };

  const handleLogoUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    try {
      const uploaded = await uploadMultiple([files[0]], true);
      const [logoFileId] = extractFileIds(uploaded);
      if (!logoFileId) {
        showError('Logo upload failed');
        return;
      }
      await saveBrandKit({
        logoFileId,
        styleFileIds: brandKit.styleFileIds || [],
        watermark: brandKit.watermark !== false,
      });
    } catch {
      showError('Logo upload failed');
    }
  };

  const handleStyleUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    try {
      const uploaded = await uploadMultiple(Array.from(files).slice(0, 3), true);
      const styleFileIds = extractFileIds(uploaded).slice(0, 3);
      if (styleFileIds.length === 0) {
        showError('Style upload failed');
        return;
      }
      await saveBrandKit({
        logoFileId: brandKit.logoFileId ?? null,
        styleFileIds,
        watermark: brandKit.watermark !== false,
      });
    } catch {
      showError('Style upload failed');
    }
  };

  const clearBrandKit = async () => {
    await saveBrandKit({ logoFileId: null, styleFileIds: [], watermark: true });
  };

  const toggleWatermark = async () => {
    await saveBrandKit({
      logoFileId: brandKit.logoFileId ?? null,
      styleFileIds: brandKit.styleFileIds || [],
      watermark: !(brandKit.watermark !== false),
    });
  };

  const setFormat = async (next: StoryFormatId) => {
    const aspectByFormat: Record<StoryFormatId, string> = {
      deck: '16x9',
      carousel: '1x1',
      feed: '4x5',
      story: '9x16',
    };
    await saveStory({
      metadata: {
        ...(story?.metadata || {}),
        format: next,
        aspectRatio: aspectByFormat[next],
      },
    });
  };

  const updateSelected = (patch: Partial<StoryBeat>) => {
    if (!selected) return;
    setBeats(beats.map((b) => (b.id === selected.id ? { ...b, ...patch } : b)));
  };

  const commitSelected = async () => {
    if (!selected) return;
    await persistBeats(beats);
  };

  const reorder = async (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const from = beats.findIndex((b) => b.id === fromId);
    const to = beats.findIndex((b) => b.id === toId);
    if (from < 0 || to < 0) return;
    const next = [...beats];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    await persistBeats(next.map((b, order) => ({ ...b, order })));
  };

  const removeBeat = async (id: string) => {
    const next = beats.filter((b) => b.id !== id).map((b, order) => ({ ...b, order }));
    if (selectedId === id) setSelectedId(next[0]?.id || null);
    await persistBeats(next);
  };

  if (isLoading || !story) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <Loader2 className="h-6 w-6 animate-spin text-teal-700" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      {/* Slim bar */}
      <header className="flex items-center gap-3 border-b border-slate-200/80 bg-white/90 px-4 py-3 backdrop-blur sm:px-6">
        <Link
          to="/studio/story"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          aria-label="Back to stories"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => void saveStory({ title })}
          className="min-w-0 flex-1 border-0 bg-transparent text-lg font-semibold tracking-tight text-slate-950 outline-none"
          placeholder="Story title"
        />
        <div className="hidden items-center gap-1.5 sm:flex">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Size
          </span>
          <select
            id="story-format"
            value={format}
            onChange={(e) => void setFormat(e.target.value as StoryFormatId)}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 outline-none"
            title="Output size for Brand, Similar, and exports"
          >
            {STORY_FORMAT_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label} · {opt.aspect}
              </option>
            ))}
          </select>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            disabled={beats.length === 0 || isProposing}
            onClick={() => void proposeStoryline({})}
            className="inline-flex items-center gap-2 rounded-full bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:opacity-40"
            title="Vision builds Context → Proof → Ask from your images"
          >
            {isProposing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            <span className="hidden sm:inline">{isProposing ? 'Building…' : 'Build story'}</span>
          </button>
          <button
            type="button"
            disabled={beats.length === 0}
            onClick={() => {
              setPreviewIndex(Math.max(0, beats.findIndex((b) => b.id === selected?.id)));
              setPreviewOpen(true);
            }}
            className="hidden rounded-full px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 sm:inline"
          >
            Preview
          </button>
          <div className="relative shrink-0">
            <button
              type="button"
              disabled={beats.length === 0 || isExporting}
              onClick={() => setExportOpen((open) => !open)}
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-40"
            >
              {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              <span className="hidden sm:inline">Export</span>
            </button>
            {exportOpen ? (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-40 cursor-default bg-transparent"
                  aria-label="Close export menu"
                  onClick={() => setExportOpen(false)}
                />
                <div
                  role="menu"
                  className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[min(18rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
                >
                  <p className="border-b border-slate-100 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Story pack · Context → Proof → Ask
                  </p>
                  {(
                    [
                      {
                        id: 'html' as const,
                        label: 'Visual board',
                        hint: 'HTML · images + copy by arc',
                      },
                      {
                        id: 'images' as const,
                        label: 'HQ images',
                        hint: 'ZIP · original-quality PNGs by arc',
                      },
                      {
                        id: 'markdown' as const,
                        label: 'Copy brief',
                        hint: 'Markdown · titles & captions by arc',
                      },
                      {
                        id: 'pptx' as const,
                        label: 'Slide deck',
                        hint: 'PPTX · matches format size, optimal image fit',
                      },
                      {
                        id: 'json' as const,
                        label: 'Data pack',
                        hint: 'JSON · structured handoff',
                      },
                    ] as const
                  ).map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      role="menuitem"
                      className="flex w-full items-start gap-3 border-b border-slate-50 px-3 py-2.5 text-left last:border-b-0 hover:bg-slate-50"
                      onClick={() => {
                        setExportOpen(false);
                        setIsExporting(true);
                        void exportStory(option.id).finally(() => setIsExporting(false));
                      }}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium leading-snug text-slate-900">
                          {option.label}
                        </span>
                        <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">
                          {option.hint}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[1400px] flex-1 gap-0 lg:grid-cols-[200px_minmax(0,1fr)_260px]">
        {/* Assets — quiet strip */}
        <aside className="flex flex-col border-b border-slate-200 bg-white lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
              Assets
            </span>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || isAddingFiles}
              className="text-slate-400 transition hover:text-teal-700 disabled:opacity-40"
              aria-label="Add assets"
            >
              {isUploading || isAddingFiles ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => void handleUpload(e.target.files)}
            />
          </div>
          <div className="flex-1 space-y-1 overflow-y-auto px-2 pb-4">
            {beats.length === 0 ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mx-2 flex w-[calc(100%-1rem)] flex-col items-center rounded-2xl border border-dashed border-slate-200 px-3 py-10 text-center text-slate-400 transition hover:border-teal-300 hover:text-teal-700"
              >
                <Upload className="h-5 w-5" />
                <span className="mt-2 text-xs">Add images</span>
              </button>
            ) : (
              beats.map((beat, index) => (
                <div
                  key={beat.id}
                  draggable
                  onDragStart={() => setDragId(beat.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragId) void reorder(dragId, beat.id);
                    setDragId(null);
                  }}
                  onClick={() => setSelectedId(beat.id)}
                  className={`group flex cursor-pointer items-center gap-2 rounded-xl px-2 py-1.5 transition ${
                    selected?.id === beat.id ? 'bg-teal-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <span className="w-4 text-[10px] tabular-nums text-slate-300">{index + 1}</span>
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-slate-100">
                    {beat.fileId ? (
                      <AuthPreviewImage fileId={beat.fileId} className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <p className="min-w-0 flex-1 truncate text-xs text-slate-700">
                    {beat.title || `Beat ${index + 1}`}
                  </p>
                  <button
                    type="button"
                    className="opacity-0 transition group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      void removeBeat(beat.id);
                    }}
                    aria-label="Remove beat"
                  >
                    <X className="h-3.5 w-3.5 text-slate-400 hover:text-rose-600" />
                  </button>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Stage — dominant */}
        <section className="relative flex min-h-[50vh] flex-col bg-slate-950 lg:min-h-0">
          <div className="relative flex flex-1 items-center justify-center p-6">
            {selected?.fileId ? (
              <AuthPreviewImage
                fileId={selected.fileId}
                alt={selected.title}
                className="max-h-[min(68vh,640px)] w-full object-contain"
              />
            ) : (
              <p className="text-sm text-slate-500">Select or add an asset</p>
            )}
            {selected?.title || selected?.caption ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-6 pb-5 pt-16">
                {selected.arcRole && selected.arcRole !== 'other' ? (
                  <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-teal-300/90">
                    {ARC_LABEL[selected.arcRole]}
                  </p>
                ) : null}
                {selected.title ? (
                  <p className="mt-1 text-xl font-semibold text-white">{selected.title}</p>
                ) : null}
                {selected.caption ? (
                  <p className="mt-1 max-w-2xl text-sm text-slate-300">{selected.caption}</p>
                ) : null}
              </div>
            ) : null}
          </div>
          {selected?.fileId ? (
            <div className="border-t border-white/10 px-4 py-3">
              <div className="mx-auto flex max-w-xl flex-col gap-2 sm:flex-row sm:items-stretch sm:justify-center">
                <button
                  type="button"
                  disabled={isBranding || isGeneratingSimilar || !selected.title?.trim()}
                  onClick={() => void brandBeat({ beatId: selected.id, textMode: 'title' })}
                  className="inline-flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl bg-teal-600 px-4 py-2.5 text-white transition hover:bg-teal-500 disabled:opacity-40"
                >
                  <span className="inline-flex items-center gap-2 text-sm font-semibold">
                    {isBranding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {isBranding ? 'Branding…' : 'Brand this beat'}
                  </span>
                  <span className="text-[10px] font-medium text-teal-100">
                    ATRISI look + your title · keeps original
                  </span>
                </button>
                <button
                  type="button"
                  disabled={isBranding || isGeneratingSimilar}
                  onClick={() => void generateSimilar({ beatId: selected.id, count: 1 })}
                  className="inline-flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-white transition hover:bg-white/10 disabled:opacity-40"
                >
                  <span className="text-sm font-semibold">
                    {isGeneratingSimilar ? 'Generating…' : 'More visuals'}
                  </span>
                  <span className="text-[10px] font-medium text-slate-300">
                    Similar scene · no text on image
                  </span>
                </button>
              </div>
              <button
                type="button"
                disabled={isBranding || isGeneratingSimilar}
                onClick={() => void brandBeat({ beatId: selected.id, textMode: 'none' })}
                className="mx-auto mt-2 block text-center text-[11px] text-slate-400 underline-offset-2 transition hover:text-slate-200 hover:underline disabled:opacity-40"
              >
                Brand look only (no on-image text)
              </button>
              {!selected.title?.trim() ? (
                <p className="mt-2 text-center text-[11px] text-amber-200/90">
                  Add a title in Edit beat to Brand with copy
                </p>
              ) : null}
            </div>
          ) : null}
          {beats.length > 1 ? (
            <div className="flex justify-center gap-1.5 overflow-x-auto px-4 pb-4">
              {beats.map((beat) => (
                <button
                  key={beat.id}
                  type="button"
                  onClick={() => setSelectedId(beat.id)}
                  className={`relative h-14 w-20 shrink-0 overflow-hidden rounded-md transition ${
                    selected?.id === beat.id
                      ? 'ring-2 ring-teal-400 ring-offset-2 ring-offset-slate-950'
                      : 'opacity-60 hover:opacity-100'
                  }`}
                >
                  {beat.fileId ? (
                    <AuthPreviewImage fileId={beat.fileId} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full bg-slate-800" />
                  )}
                  {beat.sourceFileId ? (
                    <span className="absolute bottom-0 inset-x-0 bg-teal-700/90 py-0.5 text-center text-[8px] font-semibold uppercase tracking-wide text-white">
                      Branded
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}
        </section>

        {/* Edit — only what you need */}
        <aside className="border-t border-slate-200 bg-white lg:border-l lg:border-t-0">
          <div className="px-5 py-4">
            <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
              Edit beat
            </span>
            {typeof story.metadata?.lastThesis === 'string' && story.metadata.lastThesis ? (
              <p className="mt-3 text-xs leading-relaxed text-slate-500">{story.metadata.lastThesis}</p>
            ) : null}
            {selected ? (
              <div className="mt-5 space-y-5">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    1 · Size &amp; arc
                  </p>
                  <label className="sr-only" htmlFor="story-format-edit">
                    Output format
                  </label>
                  <select
                    id="story-format-edit"
                    value={format}
                    onChange={(e) => void setFormat(e.target.value as StoryFormatId)}
                    className="mt-2 w-full border-0 border-b border-slate-200 bg-transparent py-2 text-sm text-slate-800 outline-none focus:border-teal-500 sm:hidden"
                  >
                    {STORY_FORMAT_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label} · {opt.aspect}
                      </option>
                    ))}
                  </select>
                  <label className="sr-only" htmlFor="story-arc">
                    Arc
                  </label>
                  <select
                    id="story-arc"
                    value={selected.arcRole || 'other'}
                    onChange={(e) =>
                      updateSelected({ arcRole: e.target.value as StoryBeat['arcRole'] })
                    }
                    onBlur={() => void commitSelected()}
                    className="mt-1 w-full border-0 border-b border-slate-200 bg-transparent py-2 text-sm text-slate-800 outline-none focus:border-teal-500"
                  >
                    <option value="context">Context — set the frame</option>
                    <option value="proof">Proof — build trust</option>
                    <option value="ask">Ask — next step</option>
                    <option value="other">Unassigned beat</option>
                  </select>
                </div>

                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    2 · Copy for Brand
                  </p>
                  <label className="sr-only" htmlFor="story-beat-title">
                    Title
                  </label>
                  <input
                    id="story-beat-title"
                    value={selected.title}
                    onChange={(e) => updateSelected({ title: e.target.value })}
                    onBlur={() => void commitSelected()}
                    placeholder="Headline (used on Brand)"
                    className="mt-2 w-full border-0 border-b border-slate-200 bg-transparent py-2 text-base font-semibold text-slate-950 outline-none placeholder:text-slate-300 focus:border-teal-500"
                  />
                  <label className="sr-only" htmlFor="story-caption">
                    Caption
                  </label>
                  <textarea
                    id="story-caption"
                    value={selected.caption}
                    onChange={(e) => updateSelected({ caption: e.target.value })}
                    onBlur={() => void commitSelected()}
                    placeholder="Caption / supporting line"
                    rows={3}
                    className="mt-1 w-full resize-none border-0 bg-transparent py-2 text-sm leading-relaxed text-slate-700 outline-none placeholder:text-slate-300"
                  />
                  {selected.vision?.what ? (
                    <p className="text-xs leading-relaxed text-slate-400">{selected.vision.what}</p>
                  ) : null}
                </div>

                {selected.fileId ? (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                      3 · Create
                    </p>
                    <div className="mt-2 flex flex-col gap-2">
                      <button
                        type="button"
                        disabled={isBranding || isGeneratingSimilar || !selected.title?.trim()}
                        onClick={() => void brandBeat({ beatId: selected.id, textMode: 'title' })}
                        className="w-full rounded-xl bg-teal-700 px-4 py-2.5 text-left transition hover:bg-teal-800 disabled:opacity-40"
                      >
                        <span className="block text-sm font-semibold text-white">
                          {isBranding ? 'Branding…' : 'Brand this beat'}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-teal-100">
                          Look + title/caption on image · original kept
                        </span>
                      </button>
                      <button
                        type="button"
                        disabled={isBranding || isGeneratingSimilar}
                        onClick={() => void generateSimilar({ beatId: selected.id, count: 1 })}
                        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-left transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-40"
                      >
                        <span className="block text-sm font-semibold text-slate-800">
                          {isGeneratingSimilar ? 'Generating…' : 'More visuals'}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-slate-500">
                          Similar scene · no text on image
                        </span>
                      </button>
                      <button
                        type="button"
                        disabled={isBranding || isGeneratingSimilar}
                        onClick={() => void brandBeat({ beatId: selected.id, textMode: 'none' })}
                        className="text-left text-[11px] text-slate-400 underline-offset-2 hover:text-slate-600 hover:underline disabled:opacity-40"
                      >
                        Brand look only (no on-image text)
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="border-t border-slate-100 pt-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    4 · Brand kit
                  </p>
                  <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                    Logo + up to 3 style examples. Logo watermarks Brand, Similar, and exports when on.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {brandKit.logoFileId ? (
                      <div className="relative h-12 w-12 overflow-hidden rounded-md bg-slate-100">
                        <AuthPreviewImage
                          fileId={brandKit.logoFileId}
                          className="h-full w-full object-contain p-1"
                        />
                        <span className="absolute bottom-0 inset-x-0 bg-black/50 py-0.5 text-center text-[9px] text-white">
                          Logo
                        </span>
                      </div>
                    ) : null}
                    {(brandKit.styleFileIds || []).map((id) => (
                      <div key={id} className="h-12 w-12 overflow-hidden rounded-md bg-slate-100">
                        <AuthPreviewImage fileId={id} className="h-full w-full object-cover" />
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-col gap-1.5">
                    <button
                      type="button"
                      disabled={isUploading || isSavingBrandKit}
                      onClick={() => logoInputRef.current?.click()}
                      className="text-left text-sm text-slate-600 transition hover:text-slate-900 disabled:opacity-40"
                    >
                      {brandKit.logoFileId ? 'Replace logo' : 'Upload logo'}
                    </button>
                    <button
                      type="button"
                      disabled={isUploading || isSavingBrandKit}
                      onClick={() => styleInputRef.current?.click()}
                      className="text-left text-sm text-slate-600 transition hover:text-slate-900 disabled:opacity-40"
                    >
                      {(brandKit.styleFileIds || []).length > 0
                        ? 'Replace style refs'
                        : 'Upload style refs'}
                    </button>
                    {brandKit.logoFileId ? (
                      <button
                        type="button"
                        disabled={isSavingBrandKit}
                        onClick={() => void toggleWatermark()}
                        className="text-left text-sm text-slate-600 transition hover:text-slate-900 disabled:opacity-40"
                      >
                        {brandKit.watermark !== false
                          ? 'Watermark on · turn off'
                          : 'Watermark off · turn on'}
                      </button>
                    ) : null}
                    {brandKit.logoFileId || (brandKit.styleFileIds || []).length > 0 ? (
                      <button
                        type="button"
                        disabled={isSavingBrandKit}
                        onClick={() => void clearBrandKit()}
                        className="text-left text-sm text-slate-400 transition hover:text-rose-600 disabled:opacity-40"
                      >
                        Clear brand refs
                      </button>
                    ) : null}
                  </div>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      void handleLogoUpload(e.target.files);
                      e.target.value = '';
                    }}
                  />
                  <input
                    ref={styleInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      void handleStyleUpload(e.target.files);
                      e.target.value = '';
                    }}
                  />
                </div>

                {isSaving || isSavingBrandKit ? (
                  <p className="text-xs text-slate-400">Saving…</p>
                ) : null}
              </div>
            ) : (
              <p className="mt-6 text-sm text-slate-400">Select a beat</p>
            )}
          </div>
        </aside>
      </div>

      {previewOpen && beats.length > 0 ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 p-4">
          <button
            type="button"
            className="absolute right-4 top-4 p-2 text-white/70 hover:text-white"
            onClick={() => setPreviewOpen(false)}
            aria-label="Close preview"
          >
            <X className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="absolute left-3 p-2 text-white/70 hover:text-white sm:left-6"
            onClick={() => setPreviewIndex((i) => (i - 1 + beats.length) % beats.length)}
            aria-label="Previous"
          >
            <ChevronLeft className="h-7 w-7" />
          </button>
          <button
            type="button"
            className="absolute right-3 p-2 text-white/70 hover:text-white sm:right-6"
            onClick={() => setPreviewIndex((i) => (i + 1) % beats.length)}
            aria-label="Next"
          >
            <ChevronRight className="h-7 w-7" />
          </button>
          <div className="max-w-5xl text-center">
            <p className="text-sm text-slate-400">
              {previewIndex + 1} / {beats.length}
            </p>
            <h3 className="mt-2 text-2xl font-semibold text-white">
              {beats[previewIndex]?.title || 'Beat'}
            </h3>
            {beats[previewIndex]?.fileId ? (
              <AuthPreviewImage
                fileId={beats[previewIndex].fileId!}
                className="mx-auto mt-6 max-h-[70vh] object-contain"
              />
            ) : null}
            {beats[previewIndex]?.caption ? (
              <p className="mx-auto mt-4 max-w-xl text-sm text-slate-300">
                {beats[previewIndex].caption}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
