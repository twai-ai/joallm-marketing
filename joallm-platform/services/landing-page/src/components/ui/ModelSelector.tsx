import React, { useState } from 'react';
import { ChevronDown, Zap, Clock, DollarSign, Star, Home, Cloud } from 'lucide-react';
import { useLLM } from '../../contexts/LLMContext';

export function ModelSelector() {
  const { availableModels, selectedModel, setSelectedModel } = useLLM();
  const [isOpen, setIsOpen] = useState(false);

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
    switch (provider) {
      case 'Ollama':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <Home className="w-3 h-3 mr-1" />
            Local
          </span>
        );
      case 'Groq':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <Zap className="w-3 h-3 mr-1" />
            Groq
          </span>
        );
      case 'OpenAI':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
            <Cloud className="w-3 h-3 mr-1" />
            OpenAI
          </span>
        );
      case 'Anthropic':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
            <Cloud className="w-3 h-3 mr-1" />
            Anthropic
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            <Cloud className="w-3 h-3 mr-1" />
            {provider}
          </span>
        );
    }
  };

  return (
    <div className="fixed top-20 right-4 z-40">
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="bg-white shadow-lg border border-gray-200 rounded-lg px-4 py-2 flex items-center space-x-3 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="font-medium text-sm">{selectedModel.name}</span>
          </div>
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute top-full right-0 mt-2 w-80 bg-white shadow-xl border border-gray-200 rounded-lg overflow-hidden">
            <div className="p-3 border-b border-gray-100 bg-gray-50">
              <h3 className="font-semibold text-gray-900">Jack of All LLMs</h3>
              <p className="text-xs text-gray-600 mt-1">Choose from multiple AI models for your task</p>
            </div>
            
            <div className="max-h-96 overflow-y-auto">
              {availableModels.map((model) => (
                <button
                  key={model.id}
                  onClick={() => {
                    setSelectedModel(model);
                    setIsOpen(false);
                  }}
                  className={`w-full p-4 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0 ${
                    selectedModel.id === model.id ? 'bg-red-50 border-red-200' : ''
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="font-medium text-gray-900">{model.name}</span>
                        {selectedModel.id === model.id && (
                          <div className="w-2 h-2 rounded-full bg-joa-primary" />
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        {getProviderIcon(model.provider)}
                        {getProviderBadge(model.provider)}
                      </div>
                    </div>
                    <div className="flex items-center space-x-1">
                      {getQualityStars(model.quality)}
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-3">{model.description}</p>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-1">
                        {getSpeedIcon(model.speed)}
                        <span className="text-xs text-gray-500 capitalize">{model.speed}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <DollarSign className="w-3 h-3 text-gray-400" />
                        <span className="text-xs text-gray-500">{model.cost}</span>
                      </div>
                    </div>
                    <div className="text-xs text-gray-400">
                      {Math.floor(model.maxTokens / 1000)}K tokens
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-1 mt-2">
                    {model.capabilities.map((capability) => (
                      <span
                        key={capability}
                        className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full"
                      >
                        {capability}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}