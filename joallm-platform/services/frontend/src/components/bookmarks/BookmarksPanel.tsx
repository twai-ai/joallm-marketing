import React, { useState, useEffect } from 'react';
import { X, Bookmark, MessageSquare, FileText, Workflow, Search, Trash2, Edit3, Save, Loader2 } from 'lucide-react';
import { bookmarksApi, Bookmark as BookmarkType, BookmarkType as ItemType } from '../../services/bookmarksApi';
import { showSuccess, showError } from '../../utils/toast';
import { useNavigate } from 'react-router-dom';

interface BookmarksPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BookmarksPanel({ isOpen, onClose }: BookmarksPanelProps) {
  const [bookmarks, setBookmarks] = useState<BookmarkType[]>([]);
  const [filteredBookmarks, setFilteredBookmarks] = useState<BookmarkType[]>([]);
  const [selectedType, setSelectedType] = useState<ItemType | 'all'>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState({ title: '', notes: '' });
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      fetchBookmarks();
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedType === 'all') {
      setFilteredBookmarks(bookmarks);
    } else {
      setFilteredBookmarks(bookmarks.filter(b => b.itemType === selectedType));
    }
  }, [bookmarks, selectedType]);

  const fetchBookmarks = async () => {
    setIsLoading(true);
    try {
      const data = await bookmarksApi.getBookmarks();
      setBookmarks(data);
    } catch (error) {
      console.error('Failed to fetch bookmarks:', error);
      showError('Failed to load bookmarks');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (bookmarkId: string) => {
    if (!confirm('Are you sure you want to remove this bookmark?')) return;

    try {
      await bookmarksApi.deleteBookmark(bookmarkId);
      setBookmarks(prev => prev.filter(b => b.id !== bookmarkId));
      showSuccess('Bookmark removed');
    } catch (error) {
      showError('Failed to remove bookmark');
    }
  };

  const handleEdit = (bookmark: BookmarkType) => {
    setEditingId(bookmark.id);
    setEditData({
      title: bookmark.title || '',
      notes: bookmark.notes || '',
    });
  };

  const handleSaveEdit = async (bookmarkId: string) => {
    try {
      const updated = await bookmarksApi.updateBookmark(bookmarkId, editData);
      setBookmarks(prev => prev.map(b => b.id === bookmarkId ? updated : b));
      setEditingId(null);
      showSuccess('Bookmark updated');
    } catch (error) {
      showError('Failed to update bookmark');
    }
  };

  const handleNavigate = (bookmark: BookmarkType) => {
    onClose();
    
    switch (bookmark.itemType) {
      case 'chat_session':
        navigate(`/chat/${bookmark.itemId}`);
        break;
      case 'file':
        navigate(`/rag-search`);
        break;
      case 'workflow':
        navigate(`/workflow/${bookmark.itemId}`);
        break;
      case 'message':
        // Navigate to the chat containing the message
        navigate(`/chat`);
        break;
      case 'search_result':
        navigate(`/rag-search`);
        break;
    }
  };

  const getIcon = (type: ItemType) => {
    switch (type) {
      case 'message':
      case 'chat_session':
        return <MessageSquare className="w-5 h-5" />;
      case 'file':
        return <FileText className="w-5 h-5" />;
      case 'workflow':
        return <Workflow className="w-5 h-5" />;
      case 'search_result':
        return <Search className="w-5 h-5" />;
    }
  };

  const getTypeLabel = (type: ItemType) => {
    switch (type) {
      case 'message':
        return 'Message';
      case 'chat_session':
        return 'Chat';
      case 'file':
        return 'File';
      case 'workflow':
        return 'Workflow';
      case 'search_result':
        return 'Search';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-yellow-100 dark:bg-yellow-900 rounded-lg flex items-center justify-center">
              <Bookmark className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Saved Items</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Your bookmarked content</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center space-x-2 p-4 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
          {['all', 'chat_session', 'message', 'file', 'workflow', 'search_result'].map((type) => (
            <button
              key={type}
              onClick={() => setSelectedType(type as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                selectedType === type
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {type === 'all' ? 'All' : getTypeLabel(type as ItemType)} 
              {type !== 'all' && ` (${bookmarks.filter(b => b.itemType === type).length})`}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : filteredBookmarks.length === 0 ? (
            <div className="text-center py-12">
              <Bookmark className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">No bookmarks found</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                {selectedType === 'all' 
                  ? 'Start bookmarking items to see them here'
                  : `No ${getTypeLabel(selectedType as ItemType).toLowerCase()} bookmarks yet`
                }
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredBookmarks.map((bookmark) => (
                <div
                  key={bookmark.id}
                  className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors group"
                >
                  <div className="flex items-start justify-between">
                    <div 
                      className="flex-1 cursor-pointer"
                      onClick={() => handleNavigate(bookmark)}
                    >
                      <div className="flex items-center space-x-3 mb-2">
                        <div className="w-8 h-8 bg-white dark:bg-gray-800 rounded-lg flex items-center justify-center">
                          {getIcon(bookmark.itemType)}
                        </div>
                        {editingId === bookmark.id ? (
                          <input
                            type="text"
                            value={editData.title}
                            onChange={(e) => setEditData(prev => ({ ...prev, title: e.target.value }))}
                            className="flex-1 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Title"
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <div className="flex-1">
                            <h3 className="font-medium text-gray-900 dark:text-white">
                              {bookmark.title || `${getTypeLabel(bookmark.itemType)} Bookmark`}
                            </h3>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {getTypeLabel(bookmark.itemType)} • {new Date(bookmark.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      {editingId === bookmark.id ? (
                        <textarea
                          value={editData.notes}
                          onChange={(e) => setEditData(prev => ({ ...prev, notes: e.target.value }))}
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          placeholder="Notes"
                          rows={2}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        bookmark.notes && (
                          <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
                            {bookmark.notes}
                          </p>
                        )
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {editingId === bookmark.id ? (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSaveEdit(bookmark.id);
                            }}
                            className="p-2 hover:bg-green-100 dark:hover:bg-green-900 rounded-lg transition-colors"
                          >
                            <Save className="w-4 h-4 text-green-600" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingId(null);
                            }}
                            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                          >
                            <X className="w-4 h-4 text-gray-600" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(bookmark);
                            }}
                            className="p-2 hover:bg-blue-100 dark:hover:bg-blue-900 rounded-lg transition-colors"
                          >
                            <Edit3 className="w-4 h-4 text-blue-600" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(bookmark.id);
                            }}
                            className="p-2 hover:bg-teal-100 dark:hover:bg-red-900 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {filteredBookmarks.length} bookmark{filteredBookmarks.length !== 1 ? 's' : ''}
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

