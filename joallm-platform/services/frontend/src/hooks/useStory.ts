import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { API_ENDPOINTS } from '../config/api';
import type { StoryBeat, StoryBrandKit, StorySession } from '../types/story';
import { readStoryBrandKit, readStoryFormat } from '../types/story';
import { apiClient } from '../utils/api-client';
import { showError, showSuccess } from '../utils/toast';

type ApiOk<T> = { success: boolean; data: T; source?: string };

export function useStories() {
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: ['stories'],
    queryFn: async () => {
      const res = await apiClient.get<ApiOk<StorySession[]>>(API_ENDPOINTS.story.list);
      return res.data || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (title?: string) => {
      const res = await apiClient.post<ApiOk<StorySession>>(API_ENDPOINTS.story.create, {
        title: title || 'Untitled story',
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stories'] });
    },
    onError: () => showError('Could not create story'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (storyId: string) => {
      await apiClient.delete(API_ENDPOINTS.story.story(storyId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stories'] });
      showSuccess('Story deleted');
    },
    onError: () => showError('Could not delete story'),
  });

  return {
    stories: listQuery.data || [],
    isLoading: listQuery.isLoading,
    refetch: listQuery.refetch,
    createStory: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    deleteStory: deleteMutation.mutateAsync,
  };
}

export function useStorySession(storyId: string | undefined) {
  const queryClient = useQueryClient();

  const storyQuery = useQuery({
    queryKey: ['story', storyId],
    enabled: Boolean(storyId),
    queryFn: async () => {
      const res = await apiClient.get<ApiOk<StorySession>>(API_ENDPOINTS.story.story(storyId!));
      return res.data;
    },
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['story', storyId] });
    queryClient.invalidateQueries({ queryKey: ['stories'] });
  }, [queryClient, storyId]);

  const saveMutation = useMutation({
    mutationFn: async (patch: Partial<StorySession> & { beats?: StoryBeat[] }) => {
      const res = await apiClient.patch<ApiOk<StorySession>>(
        API_ENDPOINTS.story.story(storyId!),
        patch,
      );
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['story', storyId], data);
      queryClient.invalidateQueries({ queryKey: ['stories'] });
    },
    onError: () => showError('Could not save story'),
  });

  const addFilesMutation = useMutation({
    mutationFn: async (fileIds: string[]) => {
      const res = await apiClient.post<ApiOk<StorySession>>(
        API_ENDPOINTS.story.addFiles(storyId!),
        { fileIds },
      );
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['story', storyId], data);
      queryClient.invalidateQueries({ queryKey: ['stories'] });
      showSuccess('Assets added to story');
    },
    onError: () => showError('Could not add assets'),
  });

  const proposeMutation = useMutation({
    mutationFn: async (options?: { refreshVision?: boolean; keepOrder?: boolean }) => {
      const res = await apiClient.post<
        ApiOk<StorySession> & {
          source?: string;
          visionCount?: number;
          reordered?: boolean;
          thesis?: string;
          warnings?: string[];
        }
      >(API_ENDPOINTS.story.propose(storyId!), options || {}, { showErrorToast: false });
      return res;
    },
    onSuccess: (res) => {
      queryClient.setQueryData(['story', storyId], res.data);
      queryClient.invalidateQueries({ queryKey: ['stories'] });
      const seen = typeof res.visionCount === 'number' ? res.visionCount : 0;
      const bits: string[] = [];
      if (res.source === 'vision-compose') {
        bits.push(`Storyline from combined vision (${seen} assets)`);
      } else if (res.source === 'vision-heuristic') {
        bits.push(`Vision read ${seen} — fallback spine`);
      } else {
        bits.push('Heuristic storyline');
      }
      if (res.reordered) bits.push('beats rearranged');
      const warn = (res.warnings || []).length;
      if (warn) bits.push(`${warn} note${warn === 1 ? '' : 's'}`);
      showSuccess(bits.join(' · '));
      // Surface first warning gently in the success string context — avoid error toasts for soft warns
      if (res.warnings?.[0]) {
        showSuccess(res.warnings[0]);
      }
    },
    onError: (error: unknown) => {
      const message =
        error && typeof error === 'object' && 'message' in error
          ? String((error as { message: string }).message)
          : 'Could not propose storyline';
      showError(message || 'Could not propose storyline');
    },
  });

  const generateBeatMutation = useMutation({
    mutationFn: async (input: { prompt: string; titleHint?: string }) => {
      const format = readStoryFormat(storyQuery.data?.metadata);
      const aspectByFormat: Record<string, string> = {
        deck: '16x9',
        carousel: '1x1',
        feed: '4x5',
        story: '9x16',
      };
      const res = await apiClient.post<ApiOk<StorySession>>(
        API_ENDPOINTS.story.generateBeat(storyId!),
        {
          prompt: input.prompt,
          titleHint: input.titleHint,
          style: format === 'deck' ? 'hero_banner' : 'social_media',
          aspectRatio: aspectByFormat[format] || '1x1',
        },
      );
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['story', storyId], data);
      showSuccess('Generated beat added');
    },
    onError: () => showError('Could not generate beat'),
  });

  const brandBeatMutation = useMutation({
    mutationFn: async (input: { beatId: string; textMode?: 'none' | 'title' }) => {
      const res = await apiClient.post<
        ApiOk<StorySession> & {
          provider?: string;
          addedBeatId?: string;
          usage?: {
            estimatedCredits?: number;
            estimatedCostCents?: number;
            provider?: string;
            imageCount?: number;
            keySource?: string;
          } | null;
        }
      >(
        API_ENDPOINTS.story.brandBeat(storyId!, input.beatId),
        { textMode: input.textMode ?? 'title' },
        { showErrorToast: false },
      );
      return { ...res, textMode: input.textMode ?? 'title' };
    },
    onSuccess: (res) => {
      queryClient.setQueryData(['story', storyId], res.data);
      const withText = res.textMode === 'title';
      const usage = res.usage;
      const usageBit = usage?.estimatedCredits
        ? ` · ~${usage.estimatedCredits} credit${usage.estimatedCredits === 1 ? '' : 's'} (~$${(
            (usage.estimatedCostCents || 0) / 100
          ).toFixed(2)})`
        : '';
      showSuccess(
        res.provider
          ? withText
            ? `Branded with title (${res.provider})${usageBit} — original kept`
            : `Brand look (${res.provider})${usageBit} — original kept`
          : 'Branded variant added — original kept',
      );
    },
    onError: (error: unknown) => {
      const message =
        error && typeof error === 'object' && 'message' in error
          ? String((error as { message: string }).message)
          : 'Could not brand beat';
      if (/402|insufficient credits/i.test(message)) {
        showError('Creative AI credits exhausted — add Ideogram key in Settings (or top up FLUX)');
      } else {
        showError(message || 'Could not brand beat — check Creative AI keys');
      }
    },
  });

  const similarBeatMutation = useMutation({
    mutationFn: async (input: { beatId: string; count?: number }) => {
      const res = await apiClient.post<
        ApiOk<StorySession> & {
          provider?: string;
          addedBeatIds?: string[];
          usage?: {
            estimatedCredits?: number;
            estimatedCostCents?: number;
            provider?: string;
            imageCount?: number;
          } | null;
        }
      >(API_ENDPOINTS.story.similarBeat(storyId!, input.beatId), {
        count: input.count || 1,
      }, { showErrorToast: false });
      return res;
    },
    onSuccess: (res) => {
      queryClient.setQueryData(['story', storyId], res.data);
      const n = res.addedBeatIds?.length || 1;
      const usage = res.usage;
      const usageBit = usage?.estimatedCredits
        ? ` · ~${usage.estimatedCredits} credit${usage.estimatedCredits === 1 ? '' : 's'} (~$${(
            (usage.estimatedCostCents || 0) / 100
          ).toFixed(2)})`
        : '';
      showSuccess(
        n > 1
          ? `${n} text-free photos (${res.provider || 'FLUX'})${usageBit}`
          : `Text-free photo (${res.provider || 'FLUX'})${usageBit} — edit title to overlay`,
      );
    },
    onError: (error: unknown) => {
      const message =
        error && typeof error === 'object' && 'message' in error
          ? String((error as { message: string }).message)
          : 'Could not generate similar';
      showError(message || 'Could not generate similar — check Creative AI keys');
    },
  });

  const brandKitMutation = useMutation({
    mutationFn: async (kit: StoryBrandKit) => {
      const res = await apiClient.put<ApiOk<StorySession> & { brandKit?: StoryBrandKit }>(
        API_ENDPOINTS.story.brandKit(storyId!),
        {
          logoFileId: kit.logoFileId ?? null,
          styleFileIds: kit.styleFileIds || [],
          watermark: kit.watermark !== false,
        },
      );
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['story', storyId], data);
      showSuccess('Brand references saved');
    },
    onError: () => showError('Could not save brand references'),
  });

  const downloadExport = useCallback(
    async (
      endpoint: string,
      fallbackFilename: string,
      successLabel: string,
    ) => {
      if (!storyId) return;
      try {
        const { blob, filename } = await apiClient.downloadBlob(endpoint, fallbackFilename);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        showSuccess(successLabel);
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : `Could not export ${successLabel}`;
        showError(message);
      }
    },
    [storyId],
  );

  const exportStory = useCallback(
    async (format: 'pptx' | 'markdown' | 'json' | 'html' | 'images') => {
      if (!storyId) return;
      if (format === 'pptx') {
        await downloadExport(
          API_ENDPOINTS.story.exportPptx(storyId),
          'atrisi-story.pptx',
          'Deck (PPTX) downloaded',
        );
        return;
      }
      if (format === 'markdown') {
        await downloadExport(
          API_ENDPOINTS.story.exportMarkdown(storyId),
          'atrisi-story.md',
          'Carousel brief downloaded',
        );
        return;
      }
      if (format === 'json') {
        await downloadExport(
          API_ENDPOINTS.story.exportJson(storyId),
          'atrisi-story.json',
          'Story JSON downloaded',
        );
        return;
      }
      if (format === 'images') {
        await downloadExport(
          API_ENDPOINTS.story.exportImages(storyId),
          'atrisi-story-images.zip',
          'HQ images ZIP downloaded',
        );
        return;
      }
      await downloadExport(
        API_ENDPOINTS.story.exportHtml(storyId),
        'atrisi-story.html',
        'Visual HTML pack downloaded',
      );
    },
    [downloadExport, storyId],
  );

  return {
    story: storyQuery.data,
    isLoading: storyQuery.isLoading,
    refetch: storyQuery.refetch,
    invalidate,
    saveStory: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
    addFiles: addFilesMutation.mutateAsync,
    isAddingFiles: addFilesMutation.isPending,
    proposeStoryline: proposeMutation.mutateAsync,
    isProposing: proposeMutation.isPending,
    generateBeat: generateBeatMutation.mutateAsync,
    isGenerating: generateBeatMutation.isPending,
    brandBeat: brandBeatMutation.mutateAsync,
    isBranding: brandBeatMutation.isPending,
    generateSimilar: similarBeatMutation.mutateAsync,
    isGeneratingSimilar: similarBeatMutation.isPending,
    saveBrandKit: brandKitMutation.mutateAsync,
    isSavingBrandKit: brandKitMutation.isPending,
    brandKit: readStoryBrandKit(storyQuery.data?.metadata),
    format: readStoryFormat(storyQuery.data?.metadata),
    exportStory,
  };
}
