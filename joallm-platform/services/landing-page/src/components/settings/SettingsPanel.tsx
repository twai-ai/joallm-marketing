import React, { useState, useEffect } from 'react';
import { X, User, Zap, Database, Shield, Bell, Palette, Key, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';
import { useUserRole } from '../../contexts/EnhancedUserRoleContext';
import { useLLM } from '../../contexts/LLMContext';
import { useAuth } from '../../contexts/AuthContext';
import { UserProfile } from '../auth/UserProfile';
import { EnhancedRoleSelector } from '../ui/EnhancedRoleSelector';
import { storage, STORAGE_KEYS } from '../../utils/storage';
import { showSuccess, showError } from '../../utils/toast';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState('general');
  const { role, setRole, getRoleConfig } = useUserRole();
  const { parameters, setParameters, isStreaming, setIsStreaming } = useLLM();
  
  // API Key management state
  const [apiKeys, setApiKeys] = useState({
    openai: '',
    anthropic: '',
    google: '',
    cohere: ''
  });
  const [showKeys, setShowKeys] = useState({
    openai: false,
    anthropic: false,
    google: false,
    cohere: false
  });
  const [keyStatus, setKeyStatus] = useState({
    openai: 'none',
    anthropic: 'none',
    google: 'none',
    cohere: 'none'
  });

  // Load saved API keys on mount
  useEffect(() => {
    const savedKeys = storage.getSecure<typeof apiKeys>(STORAGE_KEYS.API_KEYS);
    if (savedKeys) {
      setApiKeys(savedKeys);
      // Update key status for non-empty keys
      Object.entries(savedKeys).forEach(([provider, key]) => {
        if (key && key.length > 10) {
          setKeyStatus(prev => ({ ...prev, [provider]: 'valid' }));
        }
      });
    }
  }, []);

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'general', label: 'General', icon: Database },
    { id: 'ai', label: 'AI Settings', icon: Zap },
    { id: 'api-keys', label: 'API Keys', icon: Key },
    { id: 'data', label: 'Data & Privacy', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'appearance', label: 'Appearance', icon: Palette },
  ];

  const updateApiKey = (provider: string, key: string) => {
    setApiKeys(prev => ({ ...prev, [provider]: key }));
    
    // Simulate key validation
    if (key.length > 10) {
      setKeyStatus(prev => ({ ...prev, [provider]: 'valid' }));
    } else if (key.length > 0) {
      setKeyStatus(prev => ({ ...prev, [provider]: 'invalid' }));
    } else {
      setKeyStatus(prev => ({ ...prev, [provider]: 'none' }));
    }
  };

  const toggleKeyVisibility = (provider: string) => {
    setShowKeys(prev => ({ ...prev, [provider]: !prev[provider as keyof typeof prev] }));
  };

  const handleSaveSettings = () => {
    // Save API keys securely
    storage.setSecure(STORAGE_KEYS.API_KEYS, apiKeys);
    
    // Save other settings
    storage.set(STORAGE_KEYS.USER_ROLE, role);
    storage.set(STORAGE_KEYS.THEME, 'light'); // TODO: Get from state
    storage.set(STORAGE_KEYS.SETTINGS, {
      parameters,
      isStreaming,
    });

    showSuccess('Settings saved successfully');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-5/6 flex">
        {/* Sidebar */}
        <div className="w-64 bg-gray-50 rounded-l-lg border-r border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">joallm.ai Settings</h2>
          </div>
          
          <nav className="p-4">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center space-x-3 px-3 py-2 text-left rounded-lg transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h3 className="text-xl font-semibold text-gray-900">
              {tabs.find(tab => tab.id === activeTab)?.label}
            </h3>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'profile' && (
              <UserProfile />
            )}
            {activeTab === 'general' && (
              <div className="space-y-6">
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Role & Access</h4>
                  <EnhancedRoleSelector compact={true} />
                </div>

                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Locale</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Language
                      </label>
                      <select className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                        <option>English</option>
                        <option>Spanish</option>
                        <option>French</option>
                        <option>German</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Time Zone
                      </label>
                      <select className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                        <option>UTC-8 (Pacific)</option>
                        <option>UTC-5 (Eastern)</option>
                        <option>UTC+0 (GMT)</option>
                        <option>UTC+1 (CET)</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'ai' && (
              <div className="space-y-6">
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-4">AI Model Parameters</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Temperature: {parameters.temperature}
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="2"
                        step="0.1"
                        value={parameters.temperature}
                        onChange={(e) => setParameters({ temperature: parseFloat(e.target.value) })}
                        className="w-full"
                      />
                      <p className="text-sm text-gray-600 mt-1">
                        Controls randomness in responses. Lower values = more focused, higher values = more creative.
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Max Tokens
                      </label>
                      <input
                        type="number"
                        value={parameters.maxTokens}
                        onChange={(e) => setParameters({ maxTokens: parseInt(e.target.value) })}
                        className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <p className="text-sm text-gray-600 mt-1">
                        Maximum number of tokens in the response.
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Top P: {parameters.topP}
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={parameters.topP}
                        onChange={(e) => setParameters({ topP: parseFloat(e.target.value) })}
                        className="w-full"
                      />
                      <p className="text-sm text-gray-600 mt-1">
                        Controls diversity via nucleus sampling.
                      </p>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Streaming Responses
                        </label>
                        <p className="text-sm text-gray-600">
                          Show AI responses as they're being generated
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={isStreaming}
                        onChange={(e) => setIsStreaming(e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'api-keys' && (
              <div className="space-y-6">
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-4">API Key Management</h4>
                  <p className="text-sm text-gray-600 mb-6">
                    Bring your own API keys to use your preferred AI providers. Your keys are stored locally and never shared.
                  </p>
                  
                  <div className="space-y-6">
                    {/* OpenAI */}
                    <div className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                            <span className="text-green-600 font-semibold text-sm">O</span>
                          </div>
                          <div>
                            <h5 className="font-medium text-gray-900">OpenAI</h5>
                            <p className="text-sm text-gray-600">GPT-4, GPT-3.5, DALL-E, Whisper</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {keyStatus.openai === 'valid' && <CheckCircle className="w-5 h-5 text-green-600" />}
                          {keyStatus.openai === 'invalid' && <AlertCircle className="w-5 h-5 text-red-600" />}
                        </div>
                      </div>
                      <div className="relative">
                        <input
                          type={showKeys.openai ? 'text' : 'password'}
                          value={apiKeys.openai}
                          onChange={(e) => updateApiKey('openai', e.target.value)}
                          placeholder="sk-..."
                          className="w-full px-3 py-2 pr-20 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <button
                          onClick={() => toggleKeyVisibility('openai')}
                          className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
                        >
                          {showKeys.openai ? <EyeOff className="w-4 h-4 text-gray-500" /> : <Eye className="w-4 h-4 text-gray-500" />}
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">OpenAI Platform</a>
                      </p>
                    </div>

                    {/* Anthropic */}
                    <div className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                            <span className="text-orange-600 font-semibold text-sm">A</span>
                          </div>
                          <div>
                            <h5 className="font-medium text-gray-900">Anthropic</h5>
                            <p className="text-sm text-gray-600">Claude 3, Claude 2</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {keyStatus.anthropic === 'valid' && <CheckCircle className="w-5 h-5 text-green-600" />}
                          {keyStatus.anthropic === 'invalid' && <AlertCircle className="w-5 h-5 text-red-600" />}
                        </div>
                      </div>
                      <div className="relative">
                        <input
                          type={showKeys.anthropic ? 'text' : 'password'}
                          value={apiKeys.anthropic}
                          onChange={(e) => updateApiKey('anthropic', e.target.value)}
                          placeholder="sk-ant-..."
                          className="w-full px-3 py-2 pr-20 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <button
                          onClick={() => toggleKeyVisibility('anthropic')}
                          className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
                        >
                          {showKeys.anthropic ? <EyeOff className="w-4 h-4 text-gray-500" /> : <Eye className="w-4 h-4 text-gray-500" />}
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Get your API key from <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Anthropic Console</a>
                      </p>
                    </div>

                    {/* Google */}
                    <div className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                            <span className="text-blue-600 font-semibold text-sm">G</span>
                          </div>
                          <div>
                            <h5 className="font-medium text-gray-900">Google</h5>
                            <p className="text-sm text-gray-600">Gemini Pro, PaLM 2</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {keyStatus.google === 'valid' && <CheckCircle className="w-5 h-5 text-green-600" />}
                          {keyStatus.google === 'invalid' && <AlertCircle className="w-5 h-5 text-red-600" />}
                        </div>
                      </div>
                      <div className="relative">
                        <input
                          type={showKeys.google ? 'text' : 'password'}
                          value={apiKeys.google}
                          onChange={(e) => updateApiKey('google', e.target.value)}
                          placeholder="AIza..."
                          className="w-full px-3 py-2 pr-20 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <button
                          onClick={() => toggleKeyVisibility('google')}
                          className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
                        >
                          {showKeys.google ? <EyeOff className="w-4 h-4 text-gray-500" /> : <Eye className="w-4 h-4 text-gray-500" />}
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Get your API key from <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Google AI Studio</a>
                      </p>
                    </div>

                    {/* Cohere */}
                    <div className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                            <span className="text-purple-600 font-semibold text-sm">C</span>
                          </div>
                          <div>
                            <h5 className="font-medium text-gray-900">Cohere</h5>
                            <p className="text-sm text-gray-600">Command, Generate, Classify</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {keyStatus.cohere === 'valid' && <CheckCircle className="w-5 h-5 text-green-600" />}
                          {keyStatus.cohere === 'invalid' && <AlertCircle className="w-5 h-5 text-red-600" />}
                        </div>
                      </div>
                      <div className="relative">
                        <input
                          type={showKeys.cohere ? 'text' : 'password'}
                          value={apiKeys.cohere}
                          onChange={(e) => updateApiKey('cohere', e.target.value)}
                          placeholder="co-..."
                          className="w-full px-3 py-2 pr-20 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <button
                          onClick={() => toggleKeyVisibility('cohere')}
                          className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
                        >
                          {showKeys.cohere ? <EyeOff className="w-4 h-4 text-gray-500" /> : <Eye className="w-4 h-4 text-gray-500" />}
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Get your API key from <a href="https://dashboard.cohere.ai/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Cohere Dashboard</a>
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                    <h6 className="font-medium text-blue-900 mb-2">💡 Pro Tip</h6>
                    <p className="text-sm text-blue-800">
                      Using your own API keys gives you full control over costs and usage. You only pay for what you use directly to the provider.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'data' && (
              <div className="space-y-6">
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Privacy & Data</h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Store Conversation History
                        </label>
                        <p className="text-sm text-gray-600">
                          Save your conversations for future reference
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        defaultChecked
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Analytics & Usage Data
                        </label>
                        <p className="text-sm text-gray-600">
                          Help us improve the platform with usage analytics
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        defaultChecked
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </div>

                    <div className="pt-4">
                      <button className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors">
                        Export My Data
                      </button>
                      <p className="text-sm text-gray-600 mt-2">
                        Download all your data in JSON format
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="space-y-6">
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Notification Preferences</h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Workflow Completion
                        </label>
                        <p className="text-sm text-gray-600">
                          Get notified when workflows finish executing
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        defaultChecked
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          System Updates
                        </label>
                        <p className="text-sm text-gray-600">
                          New features and platform updates
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        defaultChecked
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Usage Alerts
                        </label>
                        <p className="text-sm text-gray-600">
                          Alerts about API limits and usage
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        defaultChecked
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'appearance' && (
              <div className="space-y-6">
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Interface Preferences</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Theme
                      </label>
                      <select className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                        <option>Light</option>
                        <option>Dark</option>
                        <option>Auto</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Font Size
                      </label>
                      <select className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                        <option>Small</option>
                        <option>Medium</option>
                        <option>Large</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Compact Mode
                        </label>
                        <p className="text-sm text-gray-600">
                          Show more content with reduced spacing
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Show Animations
                        </label>
                        <p className="text-sm text-gray-600">
                          Enable smooth transitions and animations
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        defaultChecked
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 p-6">
            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveSettings}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}