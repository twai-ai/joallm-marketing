import React, { useState } from 'react';
import { Filter, X, ChevronDown, Calendar, FileType, TrendingUp, CheckCircle, AlertCircle, Clock } from 'lucide-react';

export interface FilterOptions {
  status: string[];
  dateRange: { start: Date | null; end: Date | null };
  fileTypes: string[];
  sortBy: 'name' | 'date' | 'size' | 'status';
  sortOrder: 'asc' | 'desc';
}

interface DocumentFiltersProps {
  filters: FilterOptions;
  onChange: (filters: FilterOptions) => void;
  documentCount: number;
  filteredCount: number;
}

export function DocumentFilters({
  filters,
  onChange,
  documentCount,
  filteredCount
}: DocumentFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const statusOptions = [
    { value: 'processed', label: 'Processed', icon: CheckCircle, color: 'text-green-600' },
    { value: 'processing', label: 'Processing', icon: Clock, color: 'text-yellow-600' },
    { value: 'failed', label: 'Failed', icon: AlertCircle, color: 'text-red-600' },
    { value: 'uploaded', label: 'Uploaded', icon: Clock, color: 'text-blue-600' },
  ];

  const fileTypeOptions = [
    { value: 'pdf', label: 'PDF' },
    { value: 'doc', label: 'Word' },
    { value: 'txt', label: 'Text' },
    { value: 'md', label: 'Markdown' },
    { value: 'csv', label: 'CSV' },
    { value: 'json', label: 'JSON' },
  ];

  const sortOptions = [
    { value: 'name', label: 'Name' },
    { value: 'date', label: 'Upload Date' },
    { value: 'size', label: 'File Size' },
    { value: 'status', label: 'Status' },
  ];

  const toggleStatus = (status: string) => {
    const newStatuses = filters.status.includes(status)
      ? filters.status.filter(s => s !== status)
      : [...filters.status, status];
    onChange({ ...filters, status: newStatuses });
  };

  const toggleFileType = (type: string) => {
    const newTypes = filters.fileTypes.includes(type)
      ? filters.fileTypes.filter(t => t !== type)
      : [...filters.fileTypes, type];
    onChange({ ...filters, fileTypes: newTypes });
  };

  const clearFilters = () => {
    onChange({
      status: [],
      dateRange: { start: null, end: null },
      fileTypes: [],
      sortBy: 'date',
      sortOrder: 'desc'
    });
  };

  const activeFiltersCount = 
    filters.status.length + 
    filters.fileTypes.length + 
    (filters.dateRange.start || filters.dateRange.end ? 1 : 0);

  const hasActiveFilters = activeFiltersCount > 0;

  return (
    <div className="bg-white border-b border-gray-200">
      {/* Filter Header */}
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center space-x-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Filter className="w-4 h-4 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">Filters</span>
            {activeFiltersCount > 0 && (
              <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full font-semibold">
                {activeFiltersCount}
              </span>
            )}
            <ChevronDown className={`w-4 h-4 text-gray-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </button>

          {/* Sort */}
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-4 h-4 text-gray-500" />
            <select
              value={filters.sortBy}
              onChange={(e) => onChange({ ...filters, sortBy: e.target.value as any })}
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {sortOptions.map(option => (
                <option key={option.value} value={option.value}>
                  Sort by {option.label}
                </option>
              ))}
            </select>
            <button
              onClick={() => onChange({ ...filters, sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc' })}
              className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              title={`Sort ${filters.sortOrder === 'asc' ? 'ascending' : 'descending'}`}
            >
              <span className="text-sm font-mono">
                {filters.sortOrder === 'asc' ? '↑' : '↓'}
              </span>
            </button>
          </div>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              <X className="w-4 h-4" />
              <span>Clear Filters</span>
            </button>
          )}
        </div>

        {/* Results Count */}
        <div className="text-sm text-gray-600">
          Showing <span className="font-semibold text-gray-900">{filteredCount}</span> of{' '}
          <span className="font-semibold text-gray-900">{documentCount}</span> documents
        </div>
      </div>

      {/* Expanded Filters */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-gray-200 bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
            {/* Status Filter */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Status
              </label>
              <div className="space-y-2">
                {statusOptions.map(option => {
                  const Icon = option.icon;
                  return (
                    <label
                      key={option.value}
                      className="flex items-center space-x-3 cursor-pointer hover:bg-white px-3 py-2 rounded-lg transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={filters.status.includes(option.value)}
                        onChange={() => toggleStatus(option.value)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <Icon className={`w-4 h-4 ${option.color}`} />
                      <span className="text-sm text-gray-700">{option.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* File Type Filter */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                File Type
              </label>
              <div className="space-y-2">
                {fileTypeOptions.map(option => (
                  <label
                    key={option.value}
                    className="flex items-center space-x-3 cursor-pointer hover:bg-white px-3 py-2 rounded-lg transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={filters.fileTypes.includes(option.value)}
                      onChange={() => toggleFileType(option.value)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <FileType className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-700">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Date Range Filter */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Upload Date
              </label>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">From</label>
                  <input
                    type="date"
                    value={filters.dateRange.start ? filters.dateRange.start.toISOString().split('T')[0] : ''}
                    onChange={(e) => onChange({
                      ...filters,
                      dateRange: {
                        ...filters.dateRange,
                        start: e.target.value ? new Date(e.target.value) : null
                      }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">To</label>
                  <input
                    type="date"
                    value={filters.dateRange.end ? filters.dateRange.end.toISOString().split('T')[0] : ''}
                    onChange={(e) => onChange({
                      ...filters,
                      dateRange: {
                        ...filters.dateRange,
                        end: e.target.value ? new Date(e.target.value) : null
                      }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Quick Filters</div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => onChange({ ...filters, status: ['processed'] })}
                className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
              >
                ✅ Show Only Processed
              </button>
              <button
                onClick={() => onChange({ ...filters, status: ['failed'] })}
                className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
              >
                ❌ Show Only Failed
              </button>
              <button
                onClick={() => onChange({
                  ...filters,
                  dateRange: {
                    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                    end: new Date()
                  }
                })}
                className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
              >
                📅 Last 7 Days
              </button>
              <button
                onClick={() => onChange({ ...filters, fileTypes: ['pdf'] })}
                className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
              >
                📄 PDFs Only
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

