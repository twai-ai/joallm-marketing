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
import type { StoryBeat } from '../types/story';
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
  const {
    story,
    isLoading,
    saveStory,
    isSaving,
    addFiles,
    isAddingFiles,
    proposeStoryline,
    isProposing,
    exportPptx,
  } = useStorySession(storyId);
  const { uploadMultiple, isUploading } = useDocuments();

  const [beats, setBeats] = useState<StoryBeat[]>([]);
  const [title, setTitle] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [dragId, setDragId] = useState<string | null>(null);

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
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            disabled={beats.length === 0 || isProposing}
            onClick={() => void proposeStoryline({})}
            className="inline-flex items-center gap-2 rounded-full bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:opacity-40"
          >
            {isProposing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            <span className="hidden sm:inline">{isProposing ? 'Reading…' : 'Propose'}</span>
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
          <button
            type="button"
            disabled={beats.length === 0}
            onClick={() => void exportPptx()}
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-40"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export</span>
          </button>
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
          {beats.length > 1 ? (
            <div className="flex justify-center gap-1.5 overflow-x-auto px-4 pb-4">
              {beats.map((beat) => (
                <button
                  key={beat.id}
                  type="button"
                  onClick={() => setSelectedId(beat.id)}
                  className={`h-14 w-20 shrink-0 overflow-hidden rounded-md transition ${
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
            {selected ? (
              <div className="mt-5 space-y-4">
                <div>
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
                    className="w-full border-0 border-b border-slate-200 bg-transparent py-2 text-sm text-slate-800 outline-none focus:border-teal-500"
                  >
                    <option value="context">Context</option>
                    <option value="proof">Proof</option>
                    <option value="ask">Ask</option>
                    <option value="other">Beat</option>
                  </select>
                </div>
                <div>
                  <label className="sr-only" htmlFor="story-beat-title">
                    Title
                  </label>
                  <input
                    id="story-beat-title"
                    value={selected.title}
                    onChange={(e) => updateSelected({ title: e.target.value })}
                    onBlur={() => void commitSelected()}
                    placeholder="Title"
                    className="w-full border-0 border-b border-slate-200 bg-transparent py-2 text-base font-semibold text-slate-950 outline-none placeholder:text-slate-300 focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="sr-only" htmlFor="story-caption">
                    Caption
                  </label>
                  <textarea
                    id="story-caption"
                    value={selected.caption}
                    onChange={(e) => updateSelected({ caption: e.target.value })}
                    onBlur={() => void commitSelected()}
                    placeholder="Caption"
                    rows={4}
                    className="w-full resize-none border-0 bg-transparent py-2 text-sm leading-relaxed text-slate-700 outline-none placeholder:text-slate-300"
                  />
                </div>
                {selected.vision?.what ? (
                  <p className="text-xs leading-relaxed text-slate-400">{selected.vision.what}</p>
                ) : null}
                {isSaving ? (
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
