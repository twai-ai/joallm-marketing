import React from 'react';
import { 
  Trash2, 
  X, 
  RefreshCw, 
  Download, 
  CheckSquare, 
  Square,
  Filter,
  Archive,
  AlertTriangle
} from 'lucide-react';

interface BulkActionToolbarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onBulkDelete: () => void;
  onBulkReindex?: () => void;
  onBulkDownload?: () => void;
  onSelectByStatus?: (status: string) => void;
  onInvertSelection?: () => void;
  isProcessing?: boolean;
}

export function BulkActionToolbar({
  selectedCount,
  totalCount,
  onSelectAll,
  onDeselectAll,
  onBulkDelete,
  onBulkReindex,
  onBulkDownload,
  onSelectByStatus,
  onInvertSelection,
  isProcessing = false
}: BulkActionToolbarProps) {
  const [showQuickSelect, setShowQuickSelect] = React.useState(false);

  if (selectedCount === 0) return null;

  return (
    <div className="sticky top-0 z-10 bg-gradient-to-r from-blue-600 to-blue-700 border-b border-blue-800 shadow-lg">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Left: Selection Info */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <CheckSquare className="w-5 h-5 text-white" />
              <span className="text-white font-semibold">
                {selectedCount} of {totalCount} selected
              </span>
            </div>
            
            {/* Quick Selection Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowQuickSelect(!showQuickSelect)}
                className="text-white hover:text-blue-200 text-sm flex items-center space-x-1 px-3 py-1 rounded hover:bg-blue-600/50 transition-colors"
              >
                <Filter className="w-4 h-4" />
                <span>Quick Select</span>
              </button>
              
              {showQuickSelect && (
                <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-xl border border-gray-200 py-1 w-48 z-20">
                  <button
                    onClick={() => {
                      onSelectAll();
                      setShowQuickSelect(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center space-x-2"
                  >
                    <CheckSquare className="w-4 h-4 text-gray-600" />
                    <span>Select All</span>
                  </button>
                  
                  <button
                    onClick={() => {
                      onDeselectAll();
                      setShowQuickSelect(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center space-x-2"
                  >
                    <Square className="w-4 h-4 text-gray-600" />
                    <span>Deselect All</span>
                  </button>

                  {onInvertSelection && (
                    <button
                      onClick={() => {
                        onInvertSelection();
                        setShowQuickSelect(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center space-x-2"
                    >
                      <RefreshCw className="w-4 h-4 text-gray-600" />
                      <span>Invert Selection</span>
                    </button>
                  )}

                  {onSelectByStatus && (
                    <>
                      <div className="border-t border-gray-200 my-1"></div>
                      <div className="px-4 py-1 text-xs font-semibold text-gray-500 uppercase">
                        Select by Status
                      </div>
                      <button
                        onClick={() => {
                          onSelectByStatus('processed');
                          setShowQuickSelect(false);
                        }}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                      >
                        <span className="text-green-600">● </span>Processed Only
                      </button>
                      <button
                        onClick={() => {
                          onSelectByStatus('failed');
                          setShowQuickSelect(false);
                        }}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                      >
                        <span className="text-red-600">● </span>Failed Only
                      </button>
                      <button
                        onClick={() => {
                          onSelectByStatus('processing');
                          setShowQuickSelect(false);
                        }}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                      >
                        <span className="text-yellow-600">● </span>Processing Only
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center space-x-2">
            {onBulkReindex && (
              <button
                onClick={onBulkReindex}
                disabled={isProcessing}
                className="flex items-center space-x-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Reindex selected documents"
              >
                <RefreshCw className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
                <span className="text-sm font-medium">Reindex</span>
              </button>
            )}

            {onBulkDownload && (
              <button
                onClick={onBulkDownload}
                disabled={isProcessing}
                className="flex items-center space-x-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Download selected documents"
              >
                <Download className="w-4 h-4" />
                <span className="text-sm font-medium">Download</span>
              </button>
            )}

            <button
              onClick={onBulkDelete}
              disabled={isProcessing}
              className="flex items-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Delete selected documents"
            >
              <Trash2 className="w-4 h-4" />
              <span className="text-sm font-medium">Delete ({selectedCount})</span>
            </button>

            <button
              onClick={onDeselectAll}
              className="flex items-center space-x-2 px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
              title="Clear selection"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Keyboard shortcut hints */}
        <div className="mt-2 text-xs text-blue-200 flex items-center space-x-4">
          <span>💡 Tips:</span>
          <span><kbd className="px-1.5 py-0.5 bg-blue-800/50 rounded text-xs">Ctrl+A</kbd> Select all</span>
          <span><kbd className="px-1.5 py-0.5 bg-blue-800/50 rounded text-xs">Ctrl+D</kbd> Deselect all</span>
          <span><kbd className="px-1.5 py-0.5 bg-blue-800/50 rounded text-xs">Del</kbd> Delete selected</span>
        </div>
      </div>
    </div>
  );
}

