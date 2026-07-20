import { apiClient } from '../utils/api-client';

export type BookmarkType = 'message' | 'chat_session' | 'file' | 'workflow' | 'search_result';

export interface Bookmark {
  id: string;
  userId: string;
  itemType: BookmarkType;
  itemId: string;
  title?: string;
  notes?: string;
  createdAt: string;
}

export interface BookmarkCounts {
  total: number;
  byType: Record<string, number>;
}

export const bookmarksApi = {
  // Get all bookmarks
  async getBookmarks(type?: BookmarkType): Promise<Bookmark[]> {
    const url = type ? `/api/bookmarks?type=${type}` : '/api/bookmarks';
    const response = await apiClient.get(url);
    return response.bookmarks;
  },

  // Get bookmark counts
  async getCounts(): Promise<BookmarkCounts> {
    return await apiClient.get('/api/bookmarks/count');
  },

  // Create bookmark
  async createBookmark(data: {
    itemType: BookmarkType;
    itemId: string;
    title?: string;
    notes?: string;
  }): Promise<Bookmark> {
    const response = await apiClient.post('/api/bookmarks', data);
    return response.bookmark;
  },

  // Update bookmark
  async updateBookmark(bookmarkId: string, data: {
    title?: string;
    notes?: string;
  }): Promise<Bookmark> {
    const response = await apiClient.put(`/api/bookmarks/${bookmarkId}`, data);
    return response.bookmark;
  },

  // Delete bookmark
  async deleteBookmark(bookmarkId: string): Promise<void> {
    await apiClient.delete(`/api/bookmarks/${bookmarkId}`);
  },

  // Check if item is bookmarked
  async checkBookmark(itemType: BookmarkType, itemId: string): Promise<{
    isBookmarked: boolean;
    bookmark: Bookmark | null;
  }> {
    return await apiClient.get(`/api/bookmarks/check/${itemType}/${itemId}`);
  },
};

