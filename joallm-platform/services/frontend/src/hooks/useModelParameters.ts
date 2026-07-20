import { useState, useEffect, useCallback, useRef } from 'react';
import { ModelParameters } from '../components/models/ModelParameters';

interface UseModelParametersOptions {
  modelId?: string;
  onParametersChange?: (parameters: ModelParameters) => void;
}

const defaultParameters: ModelParameters = {
  temperature: 0.7,
  maxTokens: 2048,
  topP: 1.0,
  frequencyPenalty: 0.0,
  presencePenalty: 0.0
};

export function useModelParameters(options: UseModelParametersOptions = {}) {
  const { modelId, onParametersChange } = options;
  const [parameters, setParameters] = useState<ModelParameters>(defaultParameters);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onParametersChangeRef = useRef(onParametersChange);
  
  // Update ref when callback changes
  useEffect(() => {
    onParametersChangeRef.current = onParametersChange;
  }, [onParametersChange]);

  // Load parameters for specific model from localStorage
  const loadModelParameters = useCallback((modelId: string) => {
    try {
      const saved = localStorage.getItem(`model-parameters-${modelId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        setParameters(parsed);
        return parsed;
      }
    } catch (error) {
      console.error('Failed to load model parameters:', error);
    }
    return defaultParameters;
  }, []);

  // Save parameters for specific model to localStorage
  const saveModelParameters = useCallback((modelId: string, params: ModelParameters) => {
    try {
      localStorage.setItem(`model-parameters-${modelId}`, JSON.stringify(params));
    } catch (error) {
      console.error('Failed to save model parameters:', error);
    }
  }, []);

  // Load default parameters from API
  const loadDefaultParameters = useCallback(async (modelId: string) => {
    if (!modelId) return defaultParameters;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/models/${modelId}/parameters`);
      if (response.ok) {
        const apiParams = await response.json();
        const formattedParams: ModelParameters = {
          temperature: apiParams.temperature || 0.7,
          maxTokens: apiParams.maxTokens || 2048,
          topP: apiParams.topP || 1.0,
          frequencyPenalty: apiParams.frequencyPenalty || 0.0,
          presencePenalty: apiParams.presencePenalty || 0.0
        };
        setParameters(formattedParams);
        return formattedParams;
      }
    } catch (error) {
      console.error('Failed to load default parameters from API:', error);
      setError('Failed to load default parameters');
    } finally {
      setIsLoading(false);
    }

    return defaultParameters;
  }, []);

  // Update parameters
  const updateParameters = useCallback((newParameters: Partial<ModelParameters>) => {
    setParameters(prev => {
      const updated = { ...prev, ...newParameters };
      // Use setTimeout to avoid calling onParametersChange during render
      setTimeout(() => onParametersChangeRef.current?.(updated), 0);
      return updated;
    });
  }, []);

  // Reset to defaults
  const resetToDefaults = useCallback(() => {
    setParameters(defaultParameters);
    setTimeout(() => onParametersChangeRef.current?.(defaultParameters), 0);
  }, []);

  // Apply preset
  const applyPreset = useCallback((preset: ModelParameters) => {
    setParameters(preset);
    setTimeout(() => onParametersChangeRef.current?.(preset), 0);
  }, []);

  // Load parameters when model changes
  useEffect(() => {
    if (modelId) {
      // First try to load saved parameters for this model
      const savedParams = loadModelParameters(modelId);
      if (savedParams) {
        setParameters(savedParams);
        // Don't call onParametersChange here to avoid infinite loops
      } else {
        // If no saved parameters, load defaults from API
        loadDefaultParameters(modelId);
      }
    }
  }, [modelId, loadModelParameters, loadDefaultParameters]);

  // Save parameters when they change
  useEffect(() => {
    if (modelId) {
      saveModelParameters(modelId, parameters);
    }
  }, [parameters, modelId, saveModelParameters]);

  // Preset management
  const savePreset = useCallback((name: string, params: ModelParameters) => {
    try {
      const presets = JSON.parse(localStorage.getItem('model-parameter-presets') || '{}');
      presets[name] = params;
      localStorage.setItem('model-parameter-presets', JSON.stringify(presets));
      return true;
    } catch (error) {
      console.error('Failed to save preset:', error);
      return false;
    }
  }, []);

  const loadPresets = useCallback(() => {
    try {
      return JSON.parse(localStorage.getItem('model-parameter-presets') || '{}');
    } catch (error) {
      console.error('Failed to load presets:', error);
      return {};
    }
  }, []);

  const deletePreset = useCallback((name: string) => {
    try {
      const presets = JSON.parse(localStorage.getItem('model-parameter-presets') || '{}');
      delete presets[name];
      localStorage.setItem('model-parameter-presets', JSON.stringify(presets));
      return true;
    } catch (error) {
      console.error('Failed to delete preset:', error);
      return false;
    }
  }, []);

  return {
    parameters,
    isLoading,
    error,
    updateParameters,
    resetToDefaults,
    applyPreset,
    savePreset,
    loadPresets,
    deletePreset,
    loadDefaultParameters
  };
}
