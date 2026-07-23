import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { API_ENDPOINTS } from '../config/api';
import type { StoryBeat, StoryBrandKit, StorySession } from '../types/story';
import { readStoryBrandKit } from '../types/story';
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
        }
      >(API_ENDPOINTS.story.propose(storyId!), options || {});
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
      showSuccess(bits.join(' · '));
    },
    onError: () => showError('Could not propose storyline'),
  });

  const generateBeatMutation = useMutation({
    mutationFn: async (input: { prompt: string; titleHint?: string }) => {
      const res = await apiClient.post<ApiOk<StorySession>>(
        API_ENDPOINTS.story.generateBeat(storyId!),
        {
          prompt: input.prompt,
          titleHint: input.titleHint,
          style: 'social_media',
          aspectRatio: '16x9',
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
    mutationFn: async (beatId: string) => {
      const res = await apiClient.post<ApiOk<StorySession> & { provider?: string }>(
        API_ENDPOINTS.story.brandBeat(storyId!, beatId),
      );
      return res;
    },
    onSuccess: (res) => {
      queryClient.setQueryData(['story', storyId], res.data);
      showSuccess(
        res.provider ? `Beat branded with ${res.provider}` : 'Beat branded with ATRISI look',
      );
    },
    onError: () => showError('Could not brand beat — check Creative AI keys'),
  });

  const similarBeatMutation = useMutation({
    mutationFn: async (input: { beatId: string; count?: number }) => {
      const res = await apiClient.post<
        ApiOk<StorySession> & { provider?: string; addedBeatIds?: string[] }
      >(API_ENDPOINTS.story.similarBeat(storyId!, input.beatId), {
        count: input.count || 1,
      });
      return res;
    },
    onSuccess: (res) => {
      queryClient.setQueryData(['story', storyId], res.data);
      const n = res.addedBeatIds?.length || 1;
      showSuccess(
        n > 1
          ? `${n} similar visuals added — copy inherited from source`
          : 'Similar visual added — copy inherited from source',
      );
    },
    onError: () => showError('Could not generate similar — check Creative AI keys'),
  });

  const brandKitMutation = useMutation({
    mutationFn: async (kit: StoryBrandKit) => {
      const res = await apiClient.put<ApiOk<StorySession> & { brandKit?: StoryBrandKit }>(
        API_ENDPOINTS.story.brandKit(storyId!),
        {
          logoFileId: kit.logoFileId ?? null,
          styleFileIds: kit.styleFileIds || [],
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

  const exportPptx = useCallback(async () => {
    if (!storyId) return;
    try {
      const { blob, filename } = await apiClient.downloadBlob(
        API_ENDPOINTS.story.exportPptx(storyId),
        'atrisi-story.pptx',
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      showSuccess('PPTX downloaded');
    } catch {
      showError('Could not export PPTX');
    }
  }, [storyId]);

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
    exportPptx,
  };
}
