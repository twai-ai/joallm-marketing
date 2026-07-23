import { useRef } from 'react';
import { Clapperboard, Loader2, Plus } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { UseCaseHomeShell } from '../components/use-cases/UseCaseHomeShell';
import { PRODUCT_LABELS } from '../constants/product';
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
      title="Assemble assets into one narrative."
      description="Upload images, propose a storyline, preview, and export. Attach to a campaign when you’re ready to publish."
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
      secondaryPanelTitle="Studio creates"
      secondaryPanelBody="Vision reads your assets. You shape the arc. Campaigns still own publish."
      secondaryPanelContent={null}
    >
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Team stories</h2>
        <p className="mt-1 text-sm text-slate-500">
          Stories shared across your organization. Creator shown on each row.
        </p>

        {isLoading ? (
          <div className="mt-8 flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : stories.length === 0 ? (
          <button
            type="button"
            onClick={() => void handleNewStory()}
            className="mt-6 flex w-full flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 px-6 py-16 text-center text-slate-500 transition hover:border-teal-300 hover:text-teal-800"
          >
            <Clapperboard className="h-7 w-7" />
            <p className="mt-3 text-sm font-medium">Start with a few images</p>
          </button>
        ) : (
          <ul className="mt-6 divide-y divide-slate-100">
            {stories.map((story) => {
              const creatorLabel =
                story.isOwner
                  ? 'You'
                  : story.ownerName || story.ownerEmail || 'Teammate';
              return (
              <li key={story.id} className="flex items-center gap-4 py-4 first:pt-0">
                <Link to={`/studio/story/${story.id}`} className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-900">{story.title}</p>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {story.beats.length} {story.beats.length === 1 ? 'beat' : 'beats'}
                    <span className="text-slate-300"> · </span>
                    Created by {creatorLabel}
                  </p>
                </Link>
                <Link
                  to={`/studio/story/${story.id}`}
                  className="text-sm font-medium text-teal-700 hover:text-teal-900"
                >
                  Open
                </Link>
                {story.isOwner !== false ? (
                  <button
                    type="button"
                    onClick={() => void deleteStory(story.id)}
                    className="text-sm text-slate-400 hover:text-rose-600"
                  >
                    Delete
                  </button>
                ) : null}
              </li>
              );
            })}
          </ul>
        )}
      </section>
    </UseCaseHomeShell>
  );
}
