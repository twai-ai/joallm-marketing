import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, MessageSquare, FileText, Brain, Settings, AlertCircle } from 'lucide-react';
import { Document } from '../../types';

interface ContextConfig {
  messageHistoryCount: number;
  documentWeights: Record<string, number>; // documentId -> weight (0-100)
  includeMemories: boolean;
  customSystemInstructions: string;
}

interface TokenUsage {
  systemPrompt: number;
  memories: number;
  documents: number;
  messageHistory: number;
  currentQuery: number;
  reservedForResponse: number;
  total: number;
  limit: number;
}

interface ContextTuningPanelProps {
  documents: Document[];
  messageCount: number;
  modelContextLimit: number; // e.g., 128000 for GPT-4 Turbo
  currentConfig: ContextConfig;
  onConfigChange: (config: ContextConfig) => void;
  isCollapsed?: boolean;
  estimatedQueryTokens?: number;
}

const PRESETS = {
  minimal: { messageHistoryCount: 5, label: 'Minimal', description: 'Recent 5 messages only' },
  balanced: { messageHistoryCount: 15, label: 'Balanced', description: 'Last 15 messages' },
  maximum: { messageHistoryCount: 50, label: 'Maximum', description: 'Up to 50 messages' },
};

export function ContextTuningPanel({
  documents,
  messageCount,
  modelContextLimit,
  currentConfig,
  onConfigChange,
  isCollapsed: initialCollapsed = false,
  estimatedQueryTokens = 0,
}: ContextTuningPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed);
  const [config, setConfig] = useState<ContextConfig>(currentConfig);

  useEffect(() => {
    setConfig(currentConfig);
  }, [currentConfig]);

  // Estimate token usage (simplified - real implementation would use tiktoken)
  const estimateTokens = (): TokenUsage => {
    const systemPrompt = 500; // Fixed base system prompt
    const memories = config.includeMemories ? 400 : 0;
    const avgTokensPerMessage = 100;
    const messageHistory = Math.min(config.messageHistoryCount, messageCount) * avgTokensPerMessage;
    const reservedForResponse = 1500;
    const currentQuery = estimatedQueryTokens || 50;

    // Document tokens based on chunks and weights
    let documents = 0;
    Object.entries(config.documentWeights).forEach(([docId, weight]) => {
      const doc = documents.find(d => d.id === docId);
      if (doc && doc.chunks) {
        // Assume ~200 tokens per chunk, adjusted by weight
        documents += doc.chunks * 200 * (weight / 100);
      }
    });

    const total = systemPrompt + memories + messageHistory + documents + currentQuery;

    return {
      systemPrompt,
      memories,
      documents: Math.round(documents),
      messageHistory,
      currentQuery,
      reservedForResponse,
      total: Math.round(total),
      limit: modelContextLimit,
    };
  };

  const tokenUsage = estimateTokens();
  const utilizationPercent = (tokenUsage.total / tokenUsage.limit) * 100;
  const remainingTokens = tokenUsage.limit - tokenUsage.total - tokenUsage.reservedForResponse;

  const getUtilizationColor = () => {
    if (utilizationPercent > 95) return 'text-red-600 bg-red-50 border-red-200';
    if (utilizationPercent > 80) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-green-600 bg-green-50 border-green-200';
  };

  const handleMessageHistoryChange = (count: number) => {
    const newConfig = { ...config, messageHistoryCount: count };
    setConfig(newConfig);
    onConfigChange(newConfig);
  };

  const handleDocumentWeightChange = (docId: string, weight: number) => {
    const newConfig = {
      ...config,
      documentWeights: { ...config.documentWeights, [docId]: weight },
    };
    setConfig(newConfig);
    onConfigChange(newConfig);
  };

  const handleMemoryToggle = () => {
    const newConfig = { ...config, includeMemories: !config.includeMemories };
    setConfig(newConfig);
    onConfigChange(newConfig);
  };

  const handleSystemInstructionsChange = (instructions: string) => {
    const newConfig = { ...config, customSystemInstructions: instructions };
    setConfig(newConfig);
    onConfigChange(newConfig);
  };

  const applyPreset = (preset: keyof typeof PRESETS) => {
    const newConfig = {
      ...config,
      messageHistoryCount: PRESETS[preset].messageHistoryCount,
    };
    setConfig(newConfig);
    onConfigChange(newConfig);
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  return (
    <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
      {/* Header */}
      <div
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="flex items-center justify-between px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-gray-600" />
          <h3 className="text-sm font-medium text-gray-900">Context Tuning</h3>
          
          {/* Token Counter Badge */}
          <div className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getUtilizationColor()}`}>
            {formatNumber(tokenUsage.total)} / {formatNumber(tokenUsage.limit)} tokens
          </div>
        </div>

        <button className="p-1 hover:bg-gray-200 rounded transition-colors">
          {isCollapsed ? (
            <ChevronDown className="w-4 h-4 text-gray-600" />
          ) : (
            <ChevronUp className="w-4 h-4 text-gray-600" />
          )}
        </button>
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className="p-4 space-y-4">
          {/* Token Usage Visualization */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-gray-600">
              <span>Token Distribution</span>
              <span>{remainingTokens > 0 ? `${formatNumber(remainingTokens)} available` : 'Context full!'}</span>
            </div>

            {/* Progress Bar */}
            <div className="h-6 bg-gray-100 rounded-lg overflow-hidden flex">
              {tokenUsage.systemPrompt > 0 && (
                <div
                  className="bg-blue-500 flex items-center justify-center text-white text-xs font-medium"
                  style={{ width: `${(tokenUsage.systemPrompt / tokenUsage.limit) * 100}%` }}
                  title={`System: ${tokenUsage.systemPrompt} tokens`}
                >
                  {tokenUsage.systemPrompt > 100 && formatNumber(tokenUsage.systemPrompt)}
                </div>
              )}
              {tokenUsage.memories > 0 && (
                <div
                  className="bg-purple-500 flex items-center justify-center text-white text-xs font-medium"
                  style={{ width: `${(tokenUsage.memories / tokenUsage.limit) * 100}%` }}
                  title={`Memories: ${tokenUsage.memories} tokens`}
                >
                  {tokenUsage.memories > 100 && formatNumber(tokenUsage.memories)}
                </div>
              )}
              {tokenUsage.documents > 0 && (
                <div
                  className="bg-indigo-500 flex items-center justify-center text-white text-xs font-medium"
                  style={{ width: `${(tokenUsage.documents / tokenUsage.limit) * 100}%` }}
                  title={`Documents: ${tokenUsage.documents} tokens`}
                >
                  {tokenUsage.documents > 100 && formatNumber(tokenUsage.documents)}
                </div>
              )}
              {tokenUsage.messageHistory > 0 && (
                <div
                  className="bg-green-500 flex items-center justify-center text-white text-xs font-medium"
                  style={{ width: `${(tokenUsage.messageHistory / tokenUsage.limit) * 100}%` }}
                  title={`History: ${tokenUsage.messageHistory} tokens`}
                >
                  {tokenUsage.messageHistory > 100 && formatNumber(tokenUsage.messageHistory)}
                </div>
              )}
              {tokenUsage.currentQuery > 0 && (
                <div
                  className="bg-yellow-500 flex items-center justify-center text-white text-xs font-medium"
                  style={{ width: `${(tokenUsage.currentQuery / tokenUsage.limit) * 100}%` }}
                  title={`Query: ${tokenUsage.currentQuery} tokens`}
                >
                  {tokenUsage.currentQuery > 50 && formatNumber(tokenUsage.currentQuery)}
                </div>
              )}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-2 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-blue-500 rounded"></div>
                <span className="text-gray-600">System ({formatNumber(tokenUsage.systemPrompt)})</span>
              </div>
              {tokenUsage.memories > 0 && (
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-purple-500 rounded"></div>
                  <span className="text-gray-600">Memories ({formatNumber(tokenUsage.memories)})</span>
                </div>
              )}
              {tokenUsage.documents > 0 && (
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-indigo-500 rounded"></div>
                  <span className="text-gray-600">Docs ({formatNumber(tokenUsage.documents)})</span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-green-500 rounded"></div>
                <span className="text-gray-600">History ({formatNumber(tokenUsage.messageHistory)})</span>
              </div>
              {tokenUsage.currentQuery > 0 && (
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-yellow-500 rounded"></div>
                  <span className="text-gray-600">Query ({formatNumber(tokenUsage.currentQuery)})</span>
                </div>
              )}
            </div>

            {/* Warning */}
            {utilizationPercent > 80 && (
              <div className={`flex items-start gap-2 p-2 rounded-lg border ${getUtilizationColor()}`}>
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p className="text-xs">
                  {utilizationPercent > 95
                    ? 'Context is nearly full! Consider reducing message history or document weights.'
                    : 'Context usage is high. Monitor token count to avoid truncation.'}
                </p>
              </div>
            )}
          </div>

          {/* Message History Slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <MessageSquare className="w-4 h-4" />
                Message History
              </label>
              <span className="text-sm font-semibold text-joa-primary">
                {config.messageHistoryCount} messages
              </span>
            </div>

            <input
              type="range"
              min="0"
              max="50"
              value={config.messageHistoryCount}
              onChange={(e) => handleMessageHistoryChange(parseInt(e.target.value))}
              className="w-full"
            />

            {/* Quick Presets */}
            <div className="flex gap-2 mt-2">
              {Object.entries(PRESETS).map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => applyPreset(key as keyof typeof PRESETS)}
                  className={`flex-1 px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                    config.messageHistoryCount === preset.messageHistoryCount
                      ? 'border-joa-primary bg-joa-primary text-white'
                      : 'border-gray-300 text-gray-700 hover:border-gray-400'
                  }`}
                  title={preset.description}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Document Weights */}
          {documents.length > 0 && (
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
                <FileText className="w-4 h-4" />
                Document Weights
              </label>

              <div className="space-y-3 max-h-64 overflow-y-auto">
                {documents.map(doc => {
                  const weight = config.documentWeights[doc.id] || 100;
                  return (
                    <div key={doc.id} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-900 truncate flex-1 mr-2">
                          {doc.metadata?.title || doc.name}
                        </span>
                        <span className="text-joa-primary font-medium">{weight}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="10"
                        value={weight}
                        onChange={(e) => handleDocumentWeightChange(doc.id, parseInt(e.target.value))}
                        className="w-full"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Memory Context Toggle */}
          <div>
            <label className="flex items-center justify-between cursor-pointer group">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-gray-600 group-hover:text-gray-900" />
                <div>
                  <p className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                    Include User Memories
                  </p>
                  <p className="text-xs text-gray-500">
                    Use learned preferences from past conversations
                  </p>
                </div>
              </div>
              <div
                onClick={handleMemoryToggle}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  config.includeMemories ? 'bg-joa-primary' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    config.includeMemories ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </div>
            </label>
          </div>

          {/* Custom System Instructions */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Custom System Instructions
            </label>
            <textarea
              value={config.customSystemInstructions}
              onChange={(e) => handleSystemInstructionsChange(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-joa-primary focus:border-transparent resize-none"
              placeholder="Add custom instructions for this conversation..."
            />
            <p className="text-xs text-gray-500 mt-1">
              These instructions will be added to the system prompt
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

