import React, { useState, useMemo, useEffect } from 'react';
import { Search, Filter, Zap, Clock, DollarSign, Star, Home, Cloud, Shield, Mic, Volume2, Globe, Code, Brain, FileText, BarChart3, MessageSquare, BookOpen, Workflow, Book, Database, History, Bookmark, Settings, Eye, Loader2 } from 'lucide-react';
import { useLLM } from '../../contexts/LLMContext';
import { modelsApiService, ModelFilters, ModelStats } from '../../services/modelsApi';
import { ModelStats as ModelStatsComponent } from '../analytics/ModelStats';

export function JoaLLMFarm() {
  const { availableModels, isLoadingModels } = useLLM();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<string>('all');
  const [selectedCapability, setSelectedCapability] = useState<string>('all');
  const [selectedSpeed, setSelectedSpeed] = useState<string>('all');
  const [selectedQuality, setSelectedQuality] = useState<string>('all');
  const [filteredModels, setFilteredModels] = useState(availableModels);
  const [isFiltering, setIsFiltering] = useState(false);
  const [providers, setProviders] = useState<string[]>([]);
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [stats, setStats] = useState<ModelStats | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [modelsPerPage, setModelsPerPage] = useState(12);
  const [currentPage, setCurrentPage] = useState(1);

  const speeds = ['fast', 'medium', 'slow'];
  const qualities = ['high', 'medium', 'low'];

  // Pagination logic
  const totalPages = Math.ceil(filteredModels.length / modelsPerPage);
  const startIndex = (currentPage - 1) * modelsPerPage;
  const endIndex = startIndex + modelsPerPage;
  const paginatedModels = filteredModels.slice(startIndex, endIndex);


  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedProvider, selectedCapability, selectedSpeed, selectedQuality]);

  // Fetch providers and capabilities from API
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [providersData, capabilitiesData, statsData] = await Promise.all([
          modelsApiService.getProviders(),
          modelsApiService.getCapabilities(),
          modelsApiService.getModelStats()
        ]);
        setProviders(providersData);
        setCapabilities(capabilitiesData);
        setStats(statsData);
      } catch (error) {
        console.error('Failed to fetch model metadata:', error);
        // Fallback to local data
        const uniqueProviders = [...new Set(availableModels.map(model => model.provider))];
        const uniqueCapabilities = [...new Set(availableModels.flatMap(model => model.capabilities))];
        setProviders(uniqueProviders.sort());
        setCapabilities(uniqueCapabilities.sort());
      }
    };

    fetchMetadata();
  }, [availableModels]);

  // Filter models - use local filtering for better performance
  useEffect(() => {
    const applyFilters = () => {
      setIsFiltering(true);
      try {
        const localFiltered = availableModels.filter(model => {
          const matchesSearch = model.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                               model.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                               model.capabilities.some(cap => cap.toLowerCase().includes(searchTerm.toLowerCase()));
          
          const matchesProvider = selectedProvider === 'all' || model.provider === selectedProvider;
          const matchesCapability = selectedCapability === 'all' || model.capabilities.includes(selectedCapability);
          const matchesSpeed = selectedSpeed === 'all' || model.speed === selectedSpeed;
          const matchesQuality = selectedQuality === 'all' || model.quality === selectedQuality;

          return matchesSearch && matchesProvider && matchesCapability && matchesSpeed && matchesQuality;
        });
        setFilteredModels(localFiltered);
      } finally {
        setIsFiltering(false);
      }
    };

    applyFilters();
  }, [searchTerm, selectedProvider, selectedCapability, selectedSpeed, selectedQuality, availableModels]);

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'Ollama':
        return <Home className="w-5 h-5 text-green-600" title="Local Model" />;
      case 'Groq':
        return <Zap className="w-5 h-5 text-blue-600" title="Groq Cloud" />;
      case 'OpenAI':
        return <Cloud className="w-5 h-5 text-purple-600" title="OpenAI Cloud" />;
      case 'Anthropic':
        return <Cloud className="w-5 h-5 text-orange-600" title="Anthropic Cloud" />;
      default:
        return <Cloud className="w-5 h-5 text-gray-600" title="Cloud Model" />;
    }
  };

  const getCapabilityIcon = (capability: string) => {
    switch (capability.toLowerCase()) {
      case 'text':
        return <FileText className="w-4 h-4" />;
      case 'code':
        return <Code className="w-4 h-4" />;
      case 'analysis':
        return <BarChart3 className="w-4 h-4" />;
      case 'reasoning':
        return <Brain className="w-4 h-4" />;
      case 'speech-to-text':
        return <Mic className="w-4 h-4" />;
      case 'text-to-speech':
        return <Volume2 className="w-4 h-4" />;
      case 'safety':
        return <Shield className="w-4 h-4" />;
      case 'multilingual':
        return <Globe className="w-4 h-4" />;
      case 'vision':
        return <Eye className="w-4 h-4" />;
      default:
        return <MessageSquare className="w-4 h-4" />;
    }
  };

  const getSpeedIcon = (speed: string) => {
    switch (speed) {
      case 'fast':
        return <Zap className="w-4 h-4 text-green-500" />;
      case 'medium':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'slow':
        return <Clock className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getQualityStars = (quality: string) => {
    const count = quality === 'high' ? 3 : quality === 'medium' ? 2 : 1;
    return Array.from({ length: 3 }).map((_, i) => (
      <Star
        key={i}
        className={`w-3 h-3 ${
          i < count ? 'text-yellow-400 fill-current' : 'text-gray-300'
        }`}
      />
    ));
  };

  const getProviderBadge = (provider: string) => {
    const colors = {
      'Groq': 'bg-blue-100 text-blue-800',
      'OpenAI': 'bg-purple-100 text-purple-800',
      'Anthropic': 'bg-orange-100 text-orange-800',
      'Ollama': 'bg-green-100 text-green-800',
    };
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[provider as keyof typeof colors] || 'bg-gray-100 text-gray-800'}`}>
        {provider}
      </span>
    );
  };

  return (
    <div className="min-h-full bg-joa-bg">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Model Library</h1>
              <p className="text-gray-600 mt-1">Explore our comprehensive collection of AI models</p>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowAnalytics(!showAnalytics)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                  showAnalytics 
                    ? 'bg-joa-primary text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                <span>Analytics</span>
              </button>
              <div className="text-sm text-gray-500">
                Showing {paginatedModels.length} of {filteredModels.length} models (Page {currentPage} of {totalPages})
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-wrap gap-4 items-center">
            {/* Search */}
            <div className="relative flex-1 min-w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search models, capabilities, or descriptions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-joa-primary focus:border-transparent"
              />
            </div>

            {/* Provider Filter */}
            <select
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-joa-primary focus:border-transparent"
            >
              <option value="all">All Providers</option>
              {providers.map(provider => (
                <option key={provider} value={provider}>{provider}</option>
              ))}
            </select>

            {/* Capability Filter */}
            <select
              value={selectedCapability}
              onChange={(e) => setSelectedCapability(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-joa-primary focus:border-transparent"
            >
              <option value="all">All Capabilities</option>
              {capabilities.map(capability => (
                <option key={capability} value={capability}>{capability}</option>
              ))}
            </select>

            {/* Speed Filter */}
            <select
              value={selectedSpeed}
              onChange={(e) => setSelectedSpeed(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-joa-primary focus:border-transparent"
            >
              <option value="all">All Speeds</option>
              {speeds.map(speed => (
                <option key={speed} value={speed}>{speed.charAt(0).toUpperCase() + speed.slice(1)}</option>
              ))}
            </select>

            {/* Quality Filter */}
            <select
              value={selectedQuality}
              onChange={(e) => setSelectedQuality(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-joa-primary focus:border-transparent"
            >
              <option value="all">All Qualities</option>
              {qualities.map(quality => (
                <option key={quality} value={quality}>{quality.charAt(0).toUpperCase() + quality.slice(1)}</option>
              ))}
            </select>

            {/* Clear Filters */}
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedProvider('all');
                setSelectedCapability('all');
                setSelectedSpeed('all');
                setSelectedQuality('all');
              }}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Clear All
            </button>
          </div>
        </div>
      </div>

      {/* Analytics Section */}
      {showAnalytics && (
        <div className="bg-gray-50 border-b border-gray-200 px-6 py-8">
          <div className="max-w-7xl mx-auto">
            <ModelStatsComponent />
          </div>
        </div>
      )}

      {/* Models Grid */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {filteredModels.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <Search className="w-12 h-12 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No models found</h3>
            <p className="text-gray-600">Try adjusting your search criteria or filters</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {paginatedModels.map((model) => (
              <div
                key={model.id}
                className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow duration-200"
              >
                {/* Model Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      {getProviderIcon(model.provider)}
                      <h3 className="font-semibold text-gray-900 text-sm leading-tight">{model.name}</h3>
                    </div>
                    {getProviderBadge(model.provider)}
                  </div>
                  <div className="flex items-center space-x-1">
                    {getQualityStars(model.quality)}
                  </div>
                </div>

                {/* Description */}
                <p className="text-sm text-gray-600 mb-4 line-clamp-2">{model.description}</p>

                {/* Capabilities */}
                <div className="mb-4">
                  <div className="flex flex-wrap gap-1">
                    {model.capabilities.slice(0, 4).map((capability) => (
                      <span
                        key={capability}
                        className="inline-flex items-center space-x-1 px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
                        title={capability}
                      >
                        {getCapabilityIcon(capability)}
                        <span>{capability}</span>
                      </span>
                    ))}
                    {model.capabilities.length > 4 && (
                      <span className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                        +{model.capabilities.length - 4} more
                      </span>
                    )}
                  </div>
                </div>

                {/* Model Stats */}
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1 text-gray-600">
                      {getSpeedIcon(model.speed)}
                      <span className="capitalize">{model.speed}</span>
                    </div>
                    <div className="flex items-center space-x-1 text-gray-600">
                      <DollarSign className="w-4 h-4" />
                      <span>{model.cost}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-gray-600">
                    <span>Max Tokens:</span>
                    <span className="font-medium">{model.maxTokens.toLocaleString()}</span>
                  </div>
                </div>

                {/* Model ID */}
                <div className="mt-4 pt-3 border-t border-gray-100">
                  <code className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded">
                    {model.id}
                  </code>
                </div>
              </div>
            ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-700">
                    Showing {startIndex + 1} to {Math.min(endIndex, filteredModels.length)} of {filteredModels.length} models
                  </span>
                  <select
                    value={modelsPerPage}
                    onChange={(e) => {
                      setModelsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="ml-4 px-3 py-1 border border-gray-300 rounded text-sm"
                  >
                    <option value={12}>12 per page</option>
                    <option value={24}>24 per page</option>
                    <option value={48}>48 per page</option>
                  </select>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Previous
                  </button>
                  
                  <div className="flex items-center space-x-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const pageNum = i + 1;
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`px-3 py-1 border rounded text-sm ${
                            currentPage === pageNum
                              ? 'bg-joa-primary text-white border-joa-primary'
                              : 'border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    {totalPages > 5 && (
                      <>
                        <span className="px-2 text-gray-500">...</span>
                        <button
                          onClick={() => setCurrentPage(totalPages)}
                          className={`px-3 py-1 border rounded text-sm ${
                            currentPage === totalPages
                              ? 'bg-joa-primary text-white border-joa-primary'
                              : 'border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {totalPages}
                        </button>
                      </>
                    )}
                  </div>

                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Stats Footer */}
      <div className="bg-gray-50 border-t border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {stats ? stats.total : availableModels.length}
              </div>
              <div className="text-sm text-gray-600">Total Models</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {stats ? Object.keys(stats.byProvider).length : providers.length}
              </div>
              <div className="text-sm text-gray-600">Providers</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {stats ? Object.keys(stats.byCapability).length : capabilities.length}
              </div>
              <div className="text-sm text-gray-600">Capabilities</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {isFiltering ? (
                  <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                ) : (
                  filteredModels.length
                )}
              </div>
              <div className="text-sm text-gray-600">Filtered Results</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
