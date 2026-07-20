import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Clock, 
  FileText, 
  Search, 
  Target, 
  Zap, 
  RefreshCw,
  Download,
  Calendar,
  Activity,
  Database,
  Brain,
  X
} from 'lucide-react';
import { useRAGAnalytics, useRAGStats } from '../../hooks/useAdvancedRAG';

interface RAGAnalyticsDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RAGAnalyticsDashboard({ isOpen, onClose }: RAGAnalyticsDashboardProps) {
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h');
  const [includeDetails, setIncludeDetails] = useState(false);

  const { 
    analytics, 
    isLoading: analyticsLoading, 
    error: analyticsError,
    refreshAnalytics, 
    forceRefresh: forceRefreshAnalytics,
    isRefetching: analyticsRefreshing,
    lastUpdated: analyticsLastUpdated
  } = useRAGAnalytics({
    timeRange,
    includeDetails
  });

  // Refresh analytics when timeRange changes
  useEffect(() => {
    if (isOpen) {
      refreshAnalytics();
    }
  }, [timeRange, isOpen, refreshAnalytics]);

  const { 
    stats, 
    isLoading: statsLoading, 
    error: statsError,
    forceRefresh: forceRefreshStats,
    isRefetching: statsRefreshing,
    lastUpdated: statsLastUpdated
  } = useRAGStats();

  if (!isOpen) return null;

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatPercentage = (num: number) => `${(num * 100).toFixed(1)}%`;

  const formatTime = (ms: number) => {
    if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
    return `${ms}ms`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-7xl h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <BarChart3 className="w-6 h-6 text-blue-600" />
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  RAG Analytics Dashboard
                </h2>
                {(analyticsRefreshing || statsRefreshing) && (
                  <div className="flex items-center space-x-1 text-blue-600">
                    <Activity className="w-4 h-4 animate-pulse" />
                    <span className="text-xs">Live</span>
                  </div>
                )}
              </div>
              {(analyticsLastUpdated || statsLastUpdated) && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Last updated: {new Date(analyticsLastUpdated || statsLastUpdated || '').toLocaleTimeString()}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {/* Time Range Selector */}
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="1h">Last Hour</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
            
            {/* Refresh Button */}
            <button
              onClick={() => {
                forceRefreshAnalytics();
                forceRefreshStats();
              }}
              disabled={analyticsRefreshing || statsRefreshing}
              className={`p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 ${
                analyticsRefreshing || statsRefreshing ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              title="Refresh data"
            >
              <RefreshCw className={`w-5 h-5 ${analyticsRefreshing || statsRefreshing ? 'animate-spin' : ''}`} />
            </button>
            
            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto h-full">
          {analyticsError || statsError ? (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
              <div className="text-red-500 text-center">
                <Database className="w-12 h-12 mx-auto mb-2" />
                <h3 className="text-lg font-semibold">Failed to load analytics data</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {analyticsError?.message || statsError?.message || 'Unknown error occurred'}
                </p>
              </div>
              <button
                onClick={() => {
                  forceRefreshAnalytics();
                  forceRefreshStats();
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : analyticsLoading || statsLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Loading analytics data...</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Total Searches */}
                <div className="bg-white dark:bg-gray-700 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Searches</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {formatNumber(analytics?.searchMetrics.totalSearches || 0)}
                      </p>
                    </div>
                    <Search className="w-8 h-8 text-blue-600" />
                  </div>
                  <div className="mt-2 flex items-center text-sm text-green-600">
                    <TrendingUp className="w-4 h-4 mr-1" />
                    +12.5% from last period
                  </div>
                </div>

                {/* Average Response Time */}
                <div className="bg-white dark:bg-gray-700 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg Response Time</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {formatTime(analytics?.searchMetrics.averageResponseTime || 0)}
                      </p>
                    </div>
                    <Clock className="w-8 h-8 text-green-600" />
                  </div>
                  <div className="mt-2 flex items-center text-sm text-green-600">
                    <TrendingUp className="w-4 h-4 mr-1" />
                    -8.2% faster
                  </div>
                </div>

                {/* Success Rate */}
                <div className="bg-white dark:bg-gray-700 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Success Rate</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {formatPercentage(analytics?.searchMetrics.successRate || 0)}
                      </p>
                    </div>
                    <Target className="w-8 h-8 text-green-600" />
                  </div>
                  <div className="mt-2 flex items-center text-sm text-green-600">
                    <TrendingUp className="w-4 h-4 mr-1" />
                    +2.1% improvement
                  </div>
                </div>

                {/* Total Documents */}
                <div className="bg-white dark:bg-gray-700 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Documents</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {analytics?.documentMetrics.totalDocuments || 0}
                      </p>
                    </div>
                    <FileText className="w-8 h-8 text-purple-600" />
                  </div>
                  <div className="mt-2 flex items-center text-sm text-blue-600">
                    <Database className="w-4 h-4 mr-1" />
                    {analytics?.documentMetrics.totalChunks || 0} chunks
                  </div>
                </div>
              </div>

              {/* Performance Metrics */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Search Performance */}
                <div className="bg-white dark:bg-gray-700 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                    <Activity className="w-5 h-5 mr-2 text-blue-600" />
                    Search Performance
                  </h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-gray-400">Average Relevance Score</span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {analytics?.performanceMetrics.averageRelevanceScore?.toFixed(2) || '0.00'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-gray-400">Context Efficiency</span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {formatPercentage(analytics?.performanceMetrics.contextEfficiency || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-gray-400">Search Latency</span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {formatTime(analytics?.performanceMetrics.searchLatency || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-gray-400">Embedding Generation</span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {formatTime(analytics?.performanceMetrics.embeddingGenerationTime || 0)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Document Utilization */}
                <div className="bg-white dark:bg-gray-700 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                    <Database className="w-5 h-5 mr-2 text-purple-600" />
                    Document Utilization
                  </h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-gray-400">Chunk Utilization</span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {formatPercentage(analytics?.documentMetrics.chunkUtilization || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-gray-400">Embedding Coverage</span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {formatPercentage(analytics?.documentMetrics.embeddingCoverage || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-gray-400">Total Chunks</span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {formatNumber(analytics?.documentMetrics.totalChunks || 0)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Top Queries */}
              <div className="bg-white dark:bg-gray-700 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                  <Search className="w-5 h-5 mr-2 text-blue-600" />
                  Top Queries
                </h3>
                <div className="space-y-3">
                  {analytics?.searchMetrics.topQueries?.map((query, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-600 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 dark:text-white">{query.query}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {query.frequency} searches • Avg score: {query.averageScore.toFixed(2)}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-semibold text-blue-600">{query.frequency}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Most Accessed Documents */}
              <div className="bg-white dark:bg-gray-700 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                  <FileText className="w-5 h-5 mr-2 text-purple-600" />
                  Most Accessed Documents
                </h3>
                <div className="space-y-3">
                  {analytics?.documentMetrics.mostAccessedDocuments?.map((doc, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-600 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 dark:text-white">{doc.name}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Last accessed: {new Date(doc.lastAccessed).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-semibold text-purple-600">{doc.accessCount}</span>
                        <p className="text-xs text-gray-500">accesses</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
