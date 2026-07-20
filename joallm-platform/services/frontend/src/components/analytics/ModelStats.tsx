import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Users, Zap, DollarSign, Star, Activity, Loader2 } from 'lucide-react';
import { modelsApiService, ModelStats as ModelStatsType } from '../../services/modelsApi';

interface ModelStatsProps {
  className?: string;
}

export function ModelStats({ className = '' }: ModelStatsProps) {
  const [stats, setStats] = useState<ModelStatsType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await modelsApiService.getModelStats();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load model statistics');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className={`bg-white border border-gray-200 rounded-lg shadow-sm p-6 ${className}`}>
        <div className="flex items-center justify-center space-x-2">
          <Loader2 className="w-5 h-5 animate-spin text-joa-primary" />
          <span className="text-gray-600">Loading model statistics...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-white border border-gray-200 rounded-lg shadow-sm p-6 ${className}`}>
        <div className="text-center">
          <div className="text-red-500 mb-2">⚠️ Error loading statistics</div>
          <p className="text-gray-600 text-sm mb-4">{error}</p>
          <button
            onClick={loadStats}
            className="px-4 py-2 bg-joa-primary text-white rounded-lg hover:bg-teal-600 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const StatCard = ({ title, value, icon, color = 'blue' }: {
    title: string;
    value: number | string;
    icon: React.ReactNode;
    color?: 'blue' | 'green' | 'purple' | 'orange' | 'red';
  }) => {
    const colorClasses = {
      blue: 'bg-blue-100 text-blue-600',
      green: 'bg-green-100 text-green-600',
      purple: 'bg-purple-100 text-purple-600',
      orange: 'bg-orange-100 text-orange-600',
      red: 'bg-red-100 text-red-600'
    };

    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
          </div>
          <div className={`p-3 rounded-full ${colorClasses[color]}`}>
            {icon}
          </div>
        </div>
      </div>
    );
  };

  const ProviderChart = ({ data }: { data: Record<string, number> }) => {
    const total = Object.values(data).reduce((sum, count) => sum + count, 0);
    const maxCount = Math.max(...Object.values(data));

    return (
      <div className="space-y-3">
        {Object.entries(data).map(([provider, count]) => {
          const percentage = total > 0 ? (count / total) * 100 : 0;
          const barWidth = maxCount > 0 ? (count / maxCount) * 100 : 0;

          return (
            <div key={provider} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="font-medium text-gray-700">{provider}</span>
                <span className="text-gray-500">{count} models</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-joa-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${barWidth}%` }}
                />
              </div>
              <div className="text-xs text-gray-500">{percentage.toFixed(1)}%</div>
            </div>
          );
        })}
      </div>
    );
  };

  const CapabilityChart = ({ data }: { data: Record<string, number> }) => {
    const total = Object.values(data).reduce((sum, count) => sum + count, 0);
    const maxCount = Math.max(...Object.values(data));

    return (
      <div className="space-y-3">
        {Object.entries(data).map(([capability, count]) => {
          const percentage = total > 0 ? (count / total) * 100 : 0;
          const barWidth = maxCount > 0 ? (count / maxCount) * 100 : 0;

          return (
            <div key={capability} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="font-medium text-gray-700">{capability}</span>
                <span className="text-gray-500">{count} models</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${barWidth}%` }}
                />
              </div>
              <div className="text-xs text-gray-500">{percentage.toFixed(1)}%</div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Model Analytics</h2>
          <p className="text-gray-600">Overview of available AI models and their distribution</p>
        </div>
        <button
          onClick={loadStats}
          className="flex items-center space-x-2 px-4 py-2 bg-joa-primary text-white rounded-lg hover:bg-teal-600 transition-colors"
        >
          <Activity className="w-4 h-4" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Models"
          value={stats.total}
          icon={<BarChart3 className="w-6 h-6" />}
          color="blue"
        />
        <StatCard
          title="Available Models"
          value={stats.available}
          icon={<Zap className="w-6 h-6" />}
          color="green"
        />
        <StatCard
          title="Featured Models"
          value={stats.featured}
          icon={<Star className="w-6 h-6" />}
          color="purple"
        />
        <StatCard
          title="Providers"
          value={Object.keys(stats.byProvider).length}
          icon={<Users className="w-6 h-6" />}
          color="orange"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Provider Distribution */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
          <div className="flex items-center space-x-2 mb-4">
            <Users className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Models by Provider</h3>
          </div>
          <ProviderChart data={stats.byProvider} />
        </div>

        {/* Capability Distribution */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
          <div className="flex items-center space-x-2 mb-4">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <h3 className="text-lg font-semibold text-gray-900">Models by Capability</h3>
          </div>
          <CapabilityChart data={stats.byCapability} />
        </div>
      </div>

      {/* Summary */}
      <div className="bg-gradient-to-r from-joa-primary to-teal-600 rounded-lg p-6 text-white">
        <div className="flex items-center space-x-2 mb-2">
          <DollarSign className="w-5 h-5" />
          <h3 className="text-lg font-semibold">Model Ecosystem Summary</h3>
        </div>
        <p className="text-red-100">
          JoaLLM provides access to <strong>{stats.total} AI models</strong> across{' '}
          <strong>{Object.keys(stats.byProvider).length} providers</strong>, with{' '}
          <strong>{stats.available} models currently available</strong> and{' '}
          <strong>{stats.featured} featured models</strong> for optimal performance.
        </p>
      </div>
    </div>
  );
}
