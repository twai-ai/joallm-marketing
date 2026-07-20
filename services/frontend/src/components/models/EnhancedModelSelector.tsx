import React, { useState, useEffect, useMemo } from 'react';
import { ChevronDown, Search, Filter, Star, Clock, Zap, Home, Cloud, Heart, History, TrendingUp, Loader2 } from 'lucide-react';
import { useLLM } from '../../contexts/LLMContext';
import { modelsApiService } from '../../services/modelsApi';

interface EnhancedModelSelectorProps {
  className?: string;
  onModelSelect?: (model: any) => void;
}

export function EnhancedModelSelector({ className = '', onModelSelect }: EnhancedModelSelectorProps) {
  const { availableModels, selectedModel, setSelectedModel, isLoadingModels } = useLLM();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<string>('all');
  const [selectedCapability, setSelectedCapability] = useState<string>('all');
  const [showFavorites, setShowFavorites] = useState(false);
  const [showRecommendations, setShowRecommendations] = useState(true);
  const [providers, setProviders] = useState<string[]>([]);
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [favoriteModels, setFavoriteModels] = useState<string[]>([]);
  const [recentModels, setRecentModels] = useState<string[]>([]);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [showAllModels, setShowAllModels] = useState(false);

  // Load favorites and recent models from localStorage
  useEffect(() => {
    const savedFavorites = localStorage.getItem('favorite-models');
    const savedRecent = localStorage.getItem('recent-models');
    
    if (savedFavorites) {
      try {
        setFavoriteModels(JSON.parse(savedFavorites));
      } catch (error) {
        console.error('Failed to load favorite models:', error);
      }
    }
    
    if (savedRecent) {
      try {
        setRecentModels(JSON.parse(savedRecent));
      } catch (error) {
        console.error('Failed to load recent models:', error);
      }
    }
  }, []);

  // Load providers and capabilities from API
  useEffect(() => {
    const loadMetadata = async () => {
      try {
        setIsLoadingStats(true);
        const [providersData, capabilitiesData] = await Promise.all([
          modelsApiService.getProviders(),
          modelsApiService.getCapabilities()
        ]);
        setProviders(providersData);
        setCapabilities(capabilitiesData);
      } catch (error) {
        console.error('Failed to load model metadata:', error);
      } finally {
        setIsLoadingStats(false);
      }
    };

    loadMetadata();
  }, []);

  // Filter models based on search and filters
  const filteredModels = useMemo(() => {
    return availableModels.filter(model => {
      const matchesSearch = model.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           model.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           model.capabilities.some(cap => cap.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesProvider = selectedProvider === 'all' || model.provider === selectedProvider;
      const matchesCapability = selectedCapability === 'all' || model.capabilities.includes(selectedCapability);
      const matchesFavorites = !showFavorites || favoriteModels.includes(model.id);
      
      return matchesSearch && matchesProvider && matchesCapability && matchesFavorites;
    });
  }, [availableModels, searchTerm, selectedProvider, selectedCapability, showFavorites, favoriteModels]);

  // Get favorite models
  const favoriteModelsList = useMemo(() => {
    return availableModels.filter(model => favoriteModels.includes(model.id));
  }, [availableModels, favoriteModels]);

  // Get recent models
  const recentModelsList = useMemo(() => {
    return availableModels.filter(model => recentModels.includes(model.id));
  }, [availableModels, recentModels]);

  // Get recommended models (featured + popular)
  const recommendedModels = useMemo(() => {
    return availableModels
      .filter(model => model.provider === 'Groq' || model.provider === 'OpenAI') // Popular providers
      .slice(0, 3);
  }, [availableModels]);

  const handleModelSelect = (model: any) => {
    setSelectedModel(model);
    setIsOpen(false);
    onModelSelect?.(model);

    // Add to recent models
    const newRecent = [model.id, ...recentModels.filter(id => id !== model.id)].slice(0, 5);
    setRecentModels(newRecent);
    localStorage.setItem('recent-models', JSON.stringify(newRecent));
  };

  const toggleFavorite = (modelId: string) => {
    const newFavorites = favoriteModels.includes(modelId)
      ? favoriteModels.filter(id => id !== modelId)
      : [...favoriteModels, modelId];
    
    setFavoriteModels(newFavorites);
    localStorage.setItem('favorite-models', JSON.stringify(newFavorites));
  };

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'Ollama':
        return <Home className="w-4 h-4 text-green-600" title="Local Model" />;
      case 'Groq':
        return <Zap className="w-4 h-4 text-blue-600" title="Groq Cloud" />;
      case 'OpenAI':
        return <Cloud className="w-4 h-4 text-purple-600" title="OpenAI Cloud" />;
      case 'Anthropic':
        return <Cloud className="w-4 h-4 text-orange-600" title="Anthropic Cloud" />;
      default:
        return <Cloud className="w-4 h-4 text-gray-600" title="Cloud Model" />;
    }
  };

  const getProviderBadge = (provider: string) => {
    const badges = {
      Ollama: 'bg-green-100 text-green-800',
      Groq: 'bg-blue-100 text-blue-800',
      OpenAI: 'bg-purple-100 text-purple-800',
      Anthropic: 'bg-orange-100 text-orange-800'
    };

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badges[provider as keyof typeof badges] || 'bg-gray-100 text-gray-800'}`}>
        {provider}
      </span>
    );
  };

  const ModelCard = ({ model, showFavorite = true }: { model: any; showFavorite?: boolean }) => (
    <button
      onClick={() => handleModelSelect(model)}
      className={`w-full p-4 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0 ${
        selectedModel.id === model.id ? 'bg-red-50 border-red-200' : ''
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2 mb-2">
            <span className="font-medium text-gray-900 truncate">{model.name}</span>
            {selectedModel.id === model.id && (
              <div className="w-2 h-2 rounded-full bg-joa-primary flex-shrink-0" />
            )}
            {showFavorite && (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFavorite(model.id);
                }}
                className="p-1 hover:bg-gray-200 rounded transition-colors cursor-pointer flex-shrink-0"
              >
                <Heart 
                  className={`w-4 h-4 ${
                    favoriteModels.includes(model.id) 
                      ? 'text-red-500 fill-current' 
                      : 'text-gray-400'
                  }`} 
                />
              </div>
            )}
          </div>
          <p className="text-sm text-gray-600 mb-2 overflow-hidden" style={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical'
          }}>{model.description}</p>
          <div className="flex items-center space-x-2">
            {getProviderIcon(model.provider)}
            {getProviderBadge(model.provider)}
          </div>
        </div>
        
        <div className="flex flex-col items-end space-y-1 ml-4 flex-shrink-0">
          <div className="flex items-center space-x-1">
            <Clock className="w-3 h-3 text-gray-400" />
            <span className="text-xs text-gray-500 capitalize">{model.speed}</span>
          </div>
          <div className="text-xs text-gray-500">{model.cost}</div>
          <div className="text-xs text-gray-400">
            {Math.floor(model.maxTokens / 1000)}K tokens
          </div>
        </div>
      </div>
      
      <div className="flex flex-wrap gap-1 mt-2">
        {model.capabilities.slice(0, 3).map((capability: string) => (
          <span
            key={capability}
            className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full"
          >
            {capability}
          </span>
        ))}
        {model.capabilities.length > 3 && (
          <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
            +{model.capabilities.length - 3}
          </span>
        )}
      </div>
    </button>
  );

  return (
    <div className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 flex items-center space-x-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 w-full min-w-[250px] max-w-[500px] shadow-sm hover:shadow-md"
        aria-label="Select AI Model"
      >
        <div className="flex items-center space-x-2.5 flex-1 min-w-0">
          <div className="w-2 h-2 rounded-full bg-green-500 dark:bg-green-400 flex-shrink-0 animate-pulse" />
          <span className="font-medium text-sm text-gray-900 dark:text-white truncate">{selectedModel.name}</span>
          <div className="text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded flex-shrink-0 font-medium">
            {selectedModel.provider}
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform duration-200 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-full min-w-[400px] max-w-[600px] bg-white dark:bg-gray-800 shadow-2xl border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 dark:text-white">Select AI Model</h3>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowRecommendations(!showRecommendations)}
                  className={`p-1.5 rounded-md transition-all duration-200 ${
                    showRecommendations 
                      ? 'bg-joa-primary text-white shadow-sm' 
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                  title="Show recommendations"
                >
                  <TrendingUp className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setShowFavorites(!showFavorites)}
                  className={`p-1.5 rounded-md transition-all duration-200 ${
                    showFavorites 
                      ? 'bg-joa-primary text-white shadow-sm' 
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                  title="Show favorites"
                >
                  <Heart className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Search and Filters */}
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search models..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-joa-primary focus:border-transparent"
                />
              </div>

              <select
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-joa-primary focus:border-transparent"
              >
                <option value="all">All Providers</option>
                {providers.map(provider => (
                  <option key={provider} value={provider}>{provider}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Content */}
          <div className={`${showAllModels ? 'max-h-[600px]' : 'max-h-96'} overflow-y-auto`}>
            {isLoadingModels ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin text-joa-primary" />
                <span className="ml-2 text-gray-600">Loading models...</span>
              </div>
            ) : (
              <>
                {/* Quick Access - Show only if there are favorites or recent */}
                {(favoriteModelsList.length > 0 || recentModelsList.length > 0) && (
                  <div className="p-4 border-b border-gray-100">
                    <div className="flex items-center space-x-2 mb-3">
                      <Star className="w-4 h-4 text-yellow-500" />
                      <h4 className="font-medium text-gray-900">Quick Access</h4>
                    </div>
                    <div className="space-y-2">
                      {favoriteModelsList.slice(0, 2).map(model => (
                        <ModelCard key={model.id} model={model} showFavorite={false} />
                      ))}
                      {recentModelsList.slice(0, 2).map(model => (
                        <ModelCard key={model.id} model={model} showFavorite={false} />
                      ))}
                    </div>
                  </div>
                )}

                {/* All Models */}
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <Filter className="w-4 h-4 text-gray-600" />
                      <h4 className="font-medium text-gray-900">
                        All Models ({filteredModels.length})
                      </h4>
                    </div>
                    {filteredModels.length > 6 && (
                      <button
                        onClick={() => setShowAllModels(!showAllModels)}
                        className="text-sm text-joa-primary hover:text-red-600 transition-colors"
                      >
                        {showAllModels ? 'Show Less' : 'Show All'}
                      </button>
                    )}
                  </div>
                  {filteredModels.length > 0 ? (
                    <>
                      {filteredModels.map(model => (
                        <ModelCard key={model.id} model={model} />
                      ))}
                      {!showAllModels && filteredModels.length > 6 && (
                        <div className="text-center py-4 text-sm text-gray-500 border-t border-gray-100 mt-2">
                          <div className="flex items-center justify-center space-x-2">
                            <span>Scroll to see more models</span>
                            <svg className="w-4 h-4 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                            </svg>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No models found matching your criteria
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
