import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Download,
  Loader2,
  Sparkles,
  Upload,
  Wand2,
  X,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { AuthPreviewImage } from '../components/story/AuthPreviewImage';
import { PLATFORM_CONSTITUTION } from '../constants/product';
import { useDocuments } from '../hooks/useDocuments';
import { useStorySession } from '../hooks/useStory';
import type { StoryBeat } from '../types/story';
import { showError } from '../utils/toast';

const ARC_LABEL: Record<string, string> = {
  context: 'Context',
  proof: 'Proof',
  ask: 'Ask',
  other: 'Beat',
};

export function StorySessionPage() {
  const { storyId } = useParams<{ storyId: string }>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    story,
    isLoading,
    saveStory,
    isSaving,
    addFiles,
    isAddingFiles,
    proposeStoryline,
    isProposing,
    generateBeat,
    isGenerating,
    exportPptx,
  } = useStorySession(storyId);
  const { uploadMultiple, isUploading } = useDocuments();

  const [beats, setBeats] = useState<StoryBeat[]>([]);
  const [title, setTitle] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [generatePrompt, setGeneratePrompt] = useState('');
  const [dragId, setDragId] = useState<string | null>(null);
  const [keepOrder, setKeepOrder] = useState(false);
  const [refreshVision, setRefreshVision] = useState(false);

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

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length || !storyId) return;
    try {
      const uploaded = await uploadMultiple(Array.from(files), true);
      const fileIds = uploaded
        .map((f) => (f as { id?: string; fileId?: string }).id || (f as { fileId?: string }).fileId)
        .filter(Boolean) as string[];
      if (fileIds.length === 0) {
        showError('Upload finished but no file ids returned');
        return;
      }
      await addFiles(fileIds);
    } catch {
      showError('Upload failed');
    }
  };

  const updateSelected = (patch: Partial<StoryBeat>) => {
    if (!selected) return;
    const next = beats.map((b) => (b.id === selected.id ? { ...b, ...patch } : b));
    setBeats(next);
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
      <div className="atrisi-page flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-6 w-6 animate-spin text-teal-700" />
      </div>
    );
  }

  return (
    <div className="atrisi-page min-h-screen bg-slate-50">
      <div className="workspace-shell flex flex-col gap-4 px-0 py-4">
        <header className="overflow-hidden rounded-3xl border border-atrisi-gray-dark bg-white shadow-sm">
          <div className="atrisi-accent-line w-full" aria-hidden />
          <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <Link
                to="/studio/story"
                className="mt-1 inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 hover:border-teal-300"
              >
                <ArrowLeft className="h-4 w-4" />
                Stories
              </Link>
              <div className="min-w-0 flex-1">
                <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">
                  <Clapperboard className="h-3.5 w-3.5" />
                  Story · Studio
                </div>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={() => void saveStory({ title })}
                  className="mt-1 w-full truncate border-0 bg-transparent text-2xl font-bold tracking-tight text-slate-950 outline-none"
                />
                <p className="mt-1 text-xs text-slate-500">
                  {story.attached ? 'Attached to Program' : 'Unattached'} · {PLATFORM_CONSTITUTION}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                <input
                  type="checkbox"
                  checked={keepOrder}
                  onChange={(e) => setKeepOrder(e.target.checked)}
                  className="rounded border-slate-300"
                />
                Keep my order
              </label>
              <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                <input
                  type="checkbox"
                  checked={refreshVision}
                  onChange={(e) => setRefreshVision(e.target.checked)}
                  className="rounded border-slate-300"
                />
                Refresh vision
              </label>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                Attach soon
              </span>
              <button
                type="button"
                disabled={beats.length === 0 || isProposing}
                onClick={() => void proposeStoryline({ keepOrder, refreshVision })}
                className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
              >
                {isProposing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {isProposing ? 'Reading assets…' : 'Propose storyline'}
              </button>
              <button
                type="button"
                disabled={beats.length === 0}
                onClick={() => {
                  setPreviewIndex(Math.max(0, beats.findIndex((b) => b.id === selected?.id)));
                  setPreviewOpen(true);
                }}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800"
              >
                Preview
              </button>
              <button
                type="button"
                disabled={beats.length === 0}
                onClick={() => void exportPptx()}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
              >
                <Download className="h-4 w-4" />
                Export PPTX
              </button>
            </div>
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)_280px]">
          {/* Assets */}
          <aside className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Assets</h2>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading || isAddingFiles}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:border-teal-300"
              >
                {isUploading || isAddingFiles ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                Add
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
            <p className="mt-1 text-xs text-slate-500">Upload images. Campaign browse comes later.</p>

            <div className="mt-4 max-h-[60vh] space-y-2 overflow-y-auto">
              {beats.length === 0 ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full flex-col items-center rounded-2xl border border-dashed border-teal-300 bg-teal-50/50 px-3 py-10 text-center"
                >
                  <Upload className="h-5 w-5 text-teal-700" />
                  <span className="mt-2 text-sm font-medium text-slate-800">Add assets</span>
                </button>
              ) : (
                beats.map((beat) => {
                  return (
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
                      className={`flex cursor-pointer items-center gap-2 rounded-xl border p-2 transition ${
                        selected?.id === beat.id
                          ? 'border-teal-400 bg-teal-50'
                          : 'border-slate-200 bg-slate-50 hover:border-teal-200'
                      }`}
                    >
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-200">
                        {beat.fileId ? (
                          <AuthPreviewImage fileId={beat.fileId} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-[10px] text-slate-500">
                            AI
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-slate-900">{beat.title || 'Beat'}</p>
                        <p className="truncate text-[10px] uppercase tracking-wide text-slate-500">
                          {ARC_LABEL[beat.arcRole || 'other']}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="rounded p-1 text-slate-400 hover:bg-white hover:text-rose-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          void removeBeat(beat.id);
                        }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="mt-4 border-t border-slate-100 pt-4">
              <label className="text-xs font-semibold text-slate-700">Generate gap-fill beat</label>
              <textarea
                value={generatePrompt}
                onChange={(e) => setGeneratePrompt(e.target.value)}
                rows={3}
                placeholder="Describe the missing beat visual…"
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-teal-400"
              />
              <button
                type="button"
                disabled={!generatePrompt.trim() || isGenerating}
                onClick={() =>
                  void generateBeat({ prompt: generatePrompt.trim(), titleHint: 'Generated beat' }).then(
                    () => setGeneratePrompt(''),
                  )
                }
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                Generate with Creative AI
              </button>
            </div>
          </aside>

          {/* Stage */}
          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 shadow-sm">
            <div className="relative flex min-h-[420px] items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 p-4">
              {selected?.fileId ? (
                <AuthPreviewImage
                  fileId={selected.fileId}
                  alt={selected.title}
                  className="max-h-[520px] w-full object-contain transition duration-300"
                />
              ) : (
                <div className="px-6 text-center">
                  <Clapperboard className="mx-auto h-10 w-10 text-teal-400/80" />
                  <p className="mt-3 text-lg font-semibold text-white">Stage</p>
                  <p className="mt-1 text-sm text-slate-400">
                    Add assets, then propose a storyline to shape the arc.
                  </p>
                </div>
              )}
              {selected && (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-5 pt-16">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-300">
                    {ARC_LABEL[selected.arcRole || 'other']}
                  </p>
                  <p className="mt-1 text-xl font-semibold text-white">{selected.title || 'Untitled beat'}</p>
                  {selected.caption ? (
                    <p className="mt-1 line-clamp-2 text-sm text-slate-200">{selected.caption}</p>
                  ) : null}
                </div>
              )}
            </div>
            {beats.length > 0 && (
              <div className="flex gap-2 overflow-x-auto border-t border-white/10 bg-slate-900/80 p-3">
                {beats.map((beat, index) => (
                  <button
                    key={beat.id}
                    type="button"
                    onClick={() => setSelectedId(beat.id)}
                    className={`relative h-16 w-24 shrink-0 overflow-hidden rounded-lg border ${
                      selected?.id === beat.id ? 'border-teal-400' : 'border-white/10'
                    }`}
                  >
                    {beat.fileId ? (
                      <AuthPreviewImage fileId={beat.fileId} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-slate-800 text-xs text-slate-400">
                        {index + 1}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Narrative */}
          <aside className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Narrative</h2>
            <p className="mt-1 text-xs text-slate-500">
              Arc: Context → Proof → Ask · Tone: ATRISI institutional
            </p>

            {selected ? (
              <div className="mt-4 space-y-3">
                <div>
                  <label className="text-xs font-medium text-slate-600">Arc role</label>
                  <select
                    value={selected.arcRole || 'other'}
                    onChange={(e) =>
                      updateSelected({ arcRole: e.target.value as StoryBeat['arcRole'] })
                    }
                    onBlur={() => void commitSelected()}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="context">Context</option>
                    <option value="proof">Proof</option>
                    <option value="ask">Ask</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Title</label>
                  <input
                    value={selected.title}
                    onChange={(e) => updateSelected({ title: e.target.value })}
                    onBlur={() => void commitSelected()}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Caption</label>
                  <textarea
                    value={selected.caption}
                    onChange={(e) => updateSelected({ caption: e.target.value })}
                    onBlur={() => void commitSelected()}
                    rows={4}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Notes</label>
                  <textarea
                    value={selected.notes}
                    onChange={(e) => updateSelected({ notes: e.target.value })}
                    onBlur={() => void commitSelected()}
                    rows={3}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                {selected.vision?.what ? (
                  <div className="rounded-xl border border-teal-100 bg-teal-50/60 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-teal-800">
                      Vision read
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-700">{selected.vision.what}</p>
                    {selected.vision.onImageText ? (
                      <p className="mt-1 text-xs text-slate-500">
                        On image: {selected.vision.onImageText}
                      </p>
                    ) : null}
                    {selected.vision.signals?.length ? (
                      <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-500">
                        {selected.vision.signals.join(' · ')}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {isSaving ? (
                  <p className="flex items-center gap-2 text-xs text-slate-500">
                    <Loader2 className="h-3 w-3 animate-spin" /> Saving…
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="mt-6 text-sm text-slate-500">Select a beat to edit narrative.</p>
            )}
          </aside>
        </div>
      </div>

      {previewOpen && beats.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4">
          <button
            type="button"
            className="absolute right-4 top-4 rounded-full border border-white/20 p-2 text-white"
            onClick={() => setPreviewOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="absolute left-4 rounded-full border border-white/20 p-2 text-white"
            onClick={() => setPreviewIndex((i) => (i - 1 + beats.length) % beats.length)}
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full border border-white/20 p-2 text-white sm:right-16"
            onClick={() => setPreviewIndex((i) => (i + 1) % beats.length)}
          >
            <ChevronRight className="h-6 w-6" />
          </button>
          <div className="max-w-5xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-300">
              {ARC_LABEL[beats[previewIndex]?.arcRole || 'other']} · {previewIndex + 1}/{beats.length}
            </p>
            <h3 className="mt-2 text-2xl font-semibold text-white">
              {beats[previewIndex]?.title || 'Beat'}
            </h3>
            {beats[previewIndex]?.fileId ? (
              <AuthPreviewImage
                fileId={beats[previewIndex].fileId!}
                className="mx-auto mt-4 max-h-[65vh] rounded-lg object-contain"
              />
            ) : null}
            {beats[previewIndex]?.caption ? (
              <p className="mx-auto mt-4 max-w-2xl text-sm text-slate-200">{beats[previewIndex].caption}</p>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
