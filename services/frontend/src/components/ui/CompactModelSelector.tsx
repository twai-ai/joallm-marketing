import React, { useState } from 'react';
import { ChevronDown, Zap, Home, Cloud } from 'lucide-react';
import { useLLM } from '../../contexts/LLMContext';

export function CompactModelSelector() {
  const { availableModels, selectedModel, setSelectedModel } = useLLM();
  const [isOpen, setIsOpen] = useState(false);

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'Ollama':
        return <Home className="w-3 h-3 text-green-600" title="Local Model" />;
      case 'Groq':
        return <Zap className="w-3 h-3 text-blue-600" title="Groq Cloud" />;
      case 'OpenAI':
        return <Cloud className="w-3 h-3 text-purple-600" title="OpenAI Cloud" />;
      case 'Anthropic':
        return <Cloud className="w-3 h-3 text-orange-600" title="Anthropic Cloud" />;
      default:
        return <Cloud className="w-3 h-3 text-gray-600" title="Cloud Model" />;
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-1.5 px-2 py-1 rounded-md hover:bg-gray-50 transition-colors border border-gray-200"
      >
        <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
        <span className="text-xs font-medium text-gray-700">{selectedModel.name}</span>
        <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1 w-64 bg-white shadow-lg border border-gray-200 rounded-lg overflow-hidden z-50">
          <div className="p-2 border-b border-gray-100 bg-gray-50">
            <h3 className="text-sm font-medium text-gray-900">Select Model</h3>
          </div>
          
          <div className="max-h-64 overflow-y-auto">
            {availableModels.map((model) => (
              <button
                key={model.id}
                onClick={() => {
                  setSelectedModel(model);
                  setIsOpen(false);
                }}
                className={`w-full p-2.5 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0 ${
                  selectedModel.id === model.id ? 'bg-red-50' : ''
                }`}
              >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-gray-900">{model.name}</span>
                      {selectedModel.id === model.id && (
                        <div className="w-1.5 h-1.5 rounded-full bg-joa-primary" />
                      )}
                    </div>
                    <div className="flex items-center space-x-1">
                      {getProviderIcon(model.provider)}
                      <span className="text-xs text-gray-500">{model.provider}</span>
                    </div>
                  </div>
                
                <p className="text-xs text-gray-600 mb-1">{model.description}</p>
                
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{model.cost}</span>
                  <span>{Math.floor(model.maxTokens / 1000)}K tokens</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}



