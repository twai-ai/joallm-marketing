import { useRef } from 'react';
import { ArrowRight, Clapperboard, Loader2, Plus, Sparkles } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { UseCaseHomeShell } from '../components/use-cases/UseCaseHomeShell';
import { PRODUCT_LABELS, PLATFORM_CONSTITUTION } from '../constants/product';
import { getUseCaseById } from '../constants/useCases';
import { useStories } from '../hooks/useStory';
import { showError } from '../utils/toast';

export function StoryPage() {
  const navigate = useNavigate();
  const useCase = getUseCaseById('story');
  const { stories, isLoading, createStory, isCreating, deleteStory } = useStories();
  const creatingRef = useRef(false);

  if (!useCase) return null;

  const handleNewStory = async () => {
    if (creatingRef.current || isCreating) return;
    creatingRef.current = true;
    try {
      const story = await createStory('Untitled story');
      navigate(`/studio/story/${story.id}`);
    } catch {
      showError('Failed to create story');
    } finally {
      creatingRef.current = false;
    }
  };

  return (
    <UseCaseHomeShell
      useCase={useCase}
      backHref="/studio"
      backLabel="Back to Studio"
      badge={
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-sm font-medium text-teal-800">
          <Clapperboard className="h-4 w-4 text-teal-600" />
          {PRODUCT_LABELS.story}
        </div>
      }
      title="Assemble assets into one ATRISI narrative — then export to any medium."
      description="Story is a Studio create workspace. Sessions stay free-floating until you attach them to a Program. Campaigns still own publish; Platform remembers the files."
      primaryAction={
        <button
          type="button"
          onClick={() => void handleNewStory()}
          disabled={isCreating}
          className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
        >
          {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          New story
        </button>
      }
      secondaryPanelTitle="Studio creates the line"
      secondaryPanelBody={PLATFORM_CONSTITUTION}
      secondaryPanelContent={
        <>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-white">
              <Sparkles className="h-4 w-4 text-teal-300" />
              See → Structure → Speak
            </div>
            <p className="mt-2 text-sm text-slate-300">
              Groq vision reads your assets, then ATRISI composes Context → Proof → Ask titles and captions.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-white">
              <Clapperboard className="h-4 w-4 text-cyan-300" />
              Export packs
            </div>
            <p className="mt-2 text-sm text-slate-300">
              Preview in Studio, download PPTX now. Attach and send to Campaigns when ready to publish.
            </p>
          </div>
        </>
      }
    >
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">Your stories</h2>
            <p className="mt-1 text-sm text-slate-600">
              Draft narratives live here until you attach them to Growth.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="mt-8 flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading stories…
          </div>
        ) : stories.length === 0 ? (
          <button
            type="button"
            onClick={() => void handleNewStory()}
            className="mt-6 flex w-full flex-col items-center justify-center rounded-2xl border border-dashed border-teal-300 bg-teal-50/40 px-6 py-16 text-center transition hover:border-teal-400 hover:bg-teal-50"
          >
            <Clapperboard className="h-8 w-8 text-teal-700" />
            <p className="mt-3 text-base font-semibold text-slate-900">Drop into a new story</p>
            <p className="mt-1 max-w-md text-sm text-slate-600">
              Add images, propose a storyline, preview, and export — no campaign required yet.
            </p>
          </button>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {stories.map((story) => (
              <div
                key={story.id}
                className="flex flex-col rounded-2xl border border-slate-200 bg-slate-50 p-5 transition hover:border-teal-300/80"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-950">{story.title}</h3>
                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
                      {story.attached ? 'Attached' : 'Unattached'} · {story.beats.length} beats ·{' '}
                      {story.status}
                    </p>
                  </div>
                </div>
                <p className="mt-3 line-clamp-2 text-sm text-slate-600">
                  {story.beats[0]?.caption || 'No storyline yet — open and propose one.'}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    to={`/studio/story/${story.id}`}
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
                  >
                    Open
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => void deleteStory(story.id)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:border-rose-200 hover:text-rose-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </UseCaseHomeShell>
  );
}
