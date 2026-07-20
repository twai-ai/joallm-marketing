import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Save, 
  RotateCcw, 
  X, 
  Database, 
  Search, 
  Brain, 
  Zap,
  Target,
  Clock,
  FileText,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

interface RAGConfigurationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSave?: (config: RAGConfig) => void;
}

interface RAGConfig {
  searchConfig: {
    defaultLimit: number;
    defaultThreshold: number;
    maxContextTokens: number;
    enableHybridSearch: boolean;
    enableQueryExpansion: boolean;
  };
  embeddingConfig: {
    model: string;
    chunkSize: number;
    chunkOverlap: number;
    enableMultiVector: boolean;
  };
  retrievalConfig: {
    rerankingEnabled: boolean;
    diversityBoost: boolean;
    temporalWeighting: boolean;
    entityBoost: boolean;
  };
}

const EMBEDDING_MODELS = [
  { id: 'text-embedding-ada-002', name: 'OpenAI Ada 002', description: 'Fast and efficient' },
  { id: 'text-embedding-3-small', name: 'OpenAI 3 Small', description: 'Better quality, small size' },
  { id: 'text-embedding-3-large', name: 'OpenAI 3 Large', description: 'Highest quality' },
  { id: 'sentence-transformers/all-MiniLM-L6-v2', name: 'MiniLM L6 v2', description: 'Open source alternative' },
];

export function RAGConfigurationPanel({ isOpen, onClose, onConfigSave }: RAGConfigurationPanelProps) {
  const [config, setConfig] = useState<RAGConfig>({
    searchConfig: {
      defaultLimit: 5,
      defaultThreshold: 0.7,
      maxContextTokens: 4000,
      enableHybridSearch: true,
      enableQueryExpansion: true,
    },
    embeddingConfig: {
      model: 'text-embedding-ada-002',
      chunkSize: 1000,
      chunkOverlap: 200,
      enableMultiVector: false,
    },
    retrievalConfig: {
      rerankingEnabled: true,
      diversityBoost: false,
      temporalWeighting: true,
      entityBoost: false,
    },
  });

  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load saved configuration on mount
  useEffect(() => {
    const savedConfig = localStorage.getItem('rag-config');
    if (savedConfig) {
      try {
        const parsedConfig = JSON.parse(savedConfig);
        setConfig(parsedConfig);
      } catch (error) {
        console.error('Failed to parse saved RAG config:', error);
      }
    }
  }, []);

  // Track changes
  useEffect(() => {
    const savedConfig = localStorage.getItem('rag-config');
    if (savedConfig) {
      const parsedConfig = JSON.parse(savedConfig);
      setHasChanges(JSON.stringify(config) !== JSON.stringify(parsedConfig));
    } else {
      setHasChanges(true);
    }
  }, [config]);

  const handleConfigChange = (section: keyof RAGConfig, key: string, value: any) => {
    setConfig(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value
      }
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Save to localStorage
      localStorage.setItem('rag-config', JSON.stringify(config));
      
      // Call onConfigSave if provided
      if (onConfigSave) {
        await onConfigSave(config);
      }
      
      setHasChanges(false);
      // Show success message
    } catch (error) {
      console.error('Failed to save RAG configuration:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    const defaultConfig: RAGConfig = {
      searchConfig: {
        defaultLimit: 5,
        defaultThreshold: 0.7,
        maxContextTokens: 4000,
        enableHybridSearch: true,
        enableQueryExpansion: true,
      },
      embeddingConfig: {
        model: 'text-embedding-ada-002',
        chunkSize: 1000,
        chunkOverlap: 200,
        enableMultiVector: false,
      },
      retrievalConfig: {
        rerankingEnabled: true,
        diversityBoost: false,
        temporalWeighting: true,
        entityBoost: false,
      },
    };
    setConfig(defaultConfig);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <Settings className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              RAG Configuration
            </h2>
          </div>
          <div className="flex items-center space-x-2">
            {hasChanges && (
              <span className="text-sm text-orange-600 dark:text-orange-400 flex items-center">
                <AlertCircle className="w-4 h-4 mr-1" />
                Unsaved changes
              </span>
            )}
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
          <div className="space-y-8">
            {/* Search Configuration */}
            <div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                <Search className="w-5 h-5 mr-2 text-blue-600" />
                Search Configuration
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Default Results Limit
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={config.searchConfig.defaultLimit}
                    onChange={(e) => handleConfigChange('searchConfig', 'defaultLimit', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Default Relevance Threshold
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.1"
                    value={config.searchConfig.defaultThreshold}
                    onChange={(e) => handleConfigChange('searchConfig', 'defaultThreshold', parseFloat(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Max Context Tokens
                  </label>
                  <input
                    type="number"
                    min="1000"
                    max="8000"
                    step="500"
                    value={config.searchConfig.maxContextTokens}
                    onChange={(e) => handleConfigChange('searchConfig', 'maxContextTokens', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
                <div className="space-y-3">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={config.searchConfig.enableHybridSearch}
                      onChange={(e) => handleConfigChange('searchConfig', 'enableHybridSearch', e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Enable Hybrid Search
                    </span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={config.searchConfig.enableQueryExpansion}
                      onChange={(e) => handleConfigChange('searchConfig', 'enableQueryExpansion', e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Enable Query Expansion
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Embedding Configuration */}
            <div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                <Brain className="w-5 h-5 mr-2 text-purple-600" />
                Embedding Configuration
              </h3>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Embedding Model
                  </label>
                  <select
                    value={config.embeddingConfig.model}
                    onChange={(e) => handleConfigChange('embeddingConfig', 'model', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  >
                    {EMBEDDING_MODELS.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.name} - {model.description}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Chunk Size
                    </label>
                    <input
                      type="number"
                      min="100"
                      max="2000"
                      step="100"
                      value={config.embeddingConfig.chunkSize}
                      onChange={(e) => handleConfigChange('embeddingConfig', 'chunkSize', parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Chunk Overlap
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="500"
                      step="50"
                      value={config.embeddingConfig.chunkOverlap}
                      onChange={(e) => handleConfigChange('embeddingConfig', 'chunkOverlap', parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={config.embeddingConfig.enableMultiVector}
                      onChange={(e) => handleConfigChange('embeddingConfig', 'enableMultiVector', e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Enable Multi-Vector Search
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Retrieval Configuration */}
            <div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                <Target className="w-5 h-5 mr-2 text-green-600" />
                Retrieval Configuration
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={config.retrievalConfig.rerankingEnabled}
                      onChange={(e) => handleConfigChange('retrievalConfig', 'rerankingEnabled', e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Enable Reranking
                    </span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={config.retrievalConfig.diversityBoost}
                      onChange={(e) => handleConfigChange('retrievalConfig', 'diversityBoost', e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Diversity Boost
                    </span>
                  </label>
                </div>
                <div className="space-y-3">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={config.retrievalConfig.temporalWeighting}
                      onChange={(e) => handleConfigChange('retrievalConfig', 'temporalWeighting', e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Temporal Weighting
                    </span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={config.retrievalConfig.entityBoost}
                      onChange={(e) => handleConfigChange('retrievalConfig', 'entityBoost', e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Entity Boost
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Configuration Summary */}
            <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg">
              <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-4 flex items-center">
                <CheckCircle className="w-5 h-5 mr-2" />
                Configuration Summary
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="font-medium text-blue-800 dark:text-blue-200">Search Settings</p>
                  <p className="text-blue-700 dark:text-blue-300">
                    Limit: {config.searchConfig.defaultLimit} • Threshold: {config.searchConfig.defaultThreshold}
                  </p>
                </div>
                <div>
                  <p className="font-medium text-blue-800 dark:text-blue-200">Embedding Model</p>
                  <p className="text-blue-700 dark:text-blue-300">
                    {EMBEDDING_MODELS.find(m => m.id === config.embeddingConfig.model)?.name}
                  </p>
                </div>
                <div>
                  <p className="font-medium text-blue-800 dark:text-blue-200">Advanced Features</p>
                  <p className="text-blue-700 dark:text-blue-300">
                    {[
                      config.searchConfig.enableHybridSearch && 'Hybrid',
                      config.retrievalConfig.rerankingEnabled && 'Rerank',
                      config.retrievalConfig.temporalWeighting && 'Temporal'
                    ].filter(Boolean).join(', ') || 'None'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleReset}
            className="flex items-center space-x-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset to Defaults</span>
          </button>
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              className="flex items-center space-x-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg"
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Configuration</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
