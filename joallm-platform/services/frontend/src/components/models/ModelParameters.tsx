import React, { useState, useEffect } from 'react';
import { Settings, RotateCcw, Save, Zap, Clock, Target, Brain, Sparkles } from 'lucide-react';
import { useLLM } from '../../contexts/LLMContext';

export interface ModelParameters {
  temperature: number;
  maxTokens: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
}

interface ModelParametersProps {
  onParametersChange?: (parameters: ModelParameters) => void;
  className?: string;
}

const parameterPresets = {
  creative: {
    name: 'Creative',
    icon: <Sparkles className="w-4 h-4" />,
    description: 'High creativity, diverse outputs',
    parameters: {
      temperature: 1.2,
      maxTokens: 2048,
      topP: 0.9,
      frequencyPenalty: 0.1,
      presencePenalty: 0.1
    }
  },
  balanced: {
    name: 'Balanced',
    icon: <Target className="w-4 h-4" />,
    description: 'Good balance of creativity and consistency',
    parameters: {
      temperature: 0.7,
      maxTokens: 2048,
      topP: 1.0,
      frequencyPenalty: 0.0,
      presencePenalty: 0.0
    }
  },
  precise: {
    name: 'Precise',
    icon: <Brain className="w-4 h-4" />,
    description: 'Focused, consistent, factual responses',
    parameters: {
      temperature: 0.3,
      maxTokens: 2048,
      topP: 0.8,
      frequencyPenalty: 0.0,
      presencePenalty: 0.0
    }
  }
};

export function ModelParameters({ onParametersChange, className = '' }: ModelParametersProps) {
  const { selectedModel } = useLLM();
  const [parameters, setParameters] = useState<ModelParameters>({
    temperature: 0.7,
    maxTokens: 2048,
    topP: 1.0,
    frequencyPenalty: 0.0,
    presencePenalty: 0.0
  });
  const [isExpanded, setIsExpanded] = useState(false);
  const [savedPresets, setSavedPresets] = useState<Record<string, ModelParameters>>({});

  // Load saved presets from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('model-parameter-presets');
    if (saved) {
      try {
        setSavedPresets(JSON.parse(saved));
      } catch (error) {
        console.error('Failed to load saved presets:', error);
      }
    }
  }, []);

  // Save presets to localStorage
  const savePresets = (presets: Record<string, ModelParameters>) => {
    localStorage.setItem('model-parameter-presets', JSON.stringify(presets));
    setSavedPresets(presets);
  };

  // Notify parent component of parameter changes
  useEffect(() => {
    onParametersChange?.(parameters);
  }, [parameters, onParametersChange]);

  const updateParameter = (key: keyof ModelParameters, value: number) => {
    setParameters(prev => ({ ...prev, [key]: value }));
  };

  const applyPreset = (preset: ModelParameters) => {
    setParameters(preset);
  };

  const resetToDefaults = () => {
    setParameters({
      temperature: 0.7,
      maxTokens: 2048,
      topP: 1.0,
      frequencyPenalty: 0.0,
      presencePenalty: 0.0
    });
  };

  const saveCurrentAsPreset = () => {
    const name = prompt('Enter a name for this preset:');
    if (name && name.trim()) {
      const newPresets = { ...savedPresets, [name.trim()]: parameters };
      savePresets(newPresets);
    }
  };

  const deletePreset = (name: string) => {
    const newPresets = { ...savedPresets };
    delete newPresets[name];
    savePresets(newPresets);
  };

  const ParameterSlider = ({ 
    label, 
    value, 
    min, 
    max, 
    step, 
    onChange, 
    description, 
    icon 
  }: {
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    onChange: (value: number) => void;
    description: string;
    icon: React.ReactNode;
  }) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {icon}
          <label className="text-sm font-medium text-gray-700">{label}</label>
        </div>
        <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
          {value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
      />
      <p className="text-xs text-gray-500">{description}</p>
    </div>
  );

  return (
    <div className={`bg-white border border-gray-200 rounded-lg shadow-sm ${className}`}>
      {/* Header */}
      <div 
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-3">
          <Settings className="w-5 h-5 text-gray-600" />
          <div>
            <h3 className="font-medium text-gray-900">Model Parameters</h3>
            <p className="text-sm text-gray-500">
              {selectedModel.name} • Temperature: {parameters.temperature}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              resetToDefaults();
            }}
            className="p-1 hover:bg-gray-200 rounded transition-colors"
            title="Reset to defaults"
          >
            <RotateCcw className="w-4 h-4 text-gray-500" />
          </button>
          <div className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-6 border-t border-gray-100">
          {/* Presets */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-3">Quick Presets</h4>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(parameterPresets).map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => applyPreset(preset.parameters)}
                  className="flex items-center space-x-2 p-3 text-left border border-gray-200 rounded-lg hover:border-joa-primary hover:bg-red-50 transition-colors"
                >
                  {preset.icon}
                  <div>
                    <div className="text-sm font-medium">{preset.name}</div>
                    <div className="text-xs text-gray-500">{preset.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Presets */}
          {Object.keys(savedPresets).length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-3">Saved Presets</h4>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(savedPresets).map(([name, preset]) => (
                  <div key={name} className="flex items-center justify-between p-2 border border-gray-200 rounded-lg">
                    <button
                      onClick={() => applyPreset(preset)}
                      className="flex-1 text-left text-sm hover:text-joa-primary transition-colors"
                    >
                      {name}
                    </button>
                    <button
                      onClick={() => deletePreset(name)}
                      className="p-1 hover:bg-gray-200 rounded transition-colors"
                      title="Delete preset"
                    >
                      <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Parameter Controls */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-gray-900">Advanced Parameters</h4>
              <button
                onClick={saveCurrentAsPreset}
                className="flex items-center space-x-1 text-sm text-joa-primary hover:text-red-600 transition-colors"
              >
                <Save className="w-4 h-4" />
                <span>Save Preset</span>
              </button>
            </div>

            <ParameterSlider
              label="Temperature"
              value={parameters.temperature}
              min={0.0}
              max={2.0}
              step={0.1}
              onChange={(value) => updateParameter('temperature', value)}
              description="Controls randomness. Higher = more creative, lower = more focused"
              icon={<Zap className="w-4 h-4 text-orange-500" />}
            />

            <ParameterSlider
              label="Max Tokens"
              value={parameters.maxTokens}
              min={1}
              max={Math.min(selectedModel.maxTokens, 32000)}
              step={1}
              onChange={(value) => updateParameter('maxTokens', value)}
              description="Maximum length of response. Higher = longer responses"
              icon={<Clock className="w-4 h-4 text-blue-500" />}
            />

            <ParameterSlider
              label="Top P"
              value={parameters.topP}
              min={0.0}
              max={1.0}
              step={0.01}
              onChange={(value) => updateParameter('topP', value)}
              description="Controls diversity via nucleus sampling. Lower = more focused"
              icon={<Target className="w-4 h-4 text-green-500" />}
            />

            <ParameterSlider
              label="Frequency Penalty"
              value={parameters.frequencyPenalty}
              min={-2.0}
              max={2.0}
              step={0.1}
              onChange={(value) => updateParameter('frequencyPenalty', value)}
              description="Reduces repetition. Positive = less repetitive"
              icon={<Brain className="w-4 h-4 text-purple-500" />}
            />

            <ParameterSlider
              label="Presence Penalty"
              value={parameters.presencePenalty}
              min={-2.0}
              max={2.0}
              step={0.1}
              onChange={(value) => updateParameter('presencePenalty', value)}
              description="Encourages new topics. Positive = more diverse topics"
              icon={<Sparkles className="w-4 h-4 text-pink-500" />}
            />
          </div>

          {/* Current Values Summary */}
          <div className="bg-gray-50 p-3 rounded-lg">
            <h5 className="text-sm font-medium text-gray-900 mb-2">Current Configuration</h5>
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
              <div>Temperature: {parameters.temperature}</div>
              <div>Max Tokens: {parameters.maxTokens.toLocaleString()}</div>
              <div>Top P: {parameters.topP}</div>
              <div>Freq Penalty: {parameters.frequencyPenalty}</div>
              <div className="col-span-2">Presence Penalty: {parameters.presencePenalty}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
