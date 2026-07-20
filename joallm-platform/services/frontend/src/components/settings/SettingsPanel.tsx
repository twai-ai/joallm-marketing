import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Bell,
  BookOpen,
  CheckCircle,
  CreditCard,
  Database,
  Download,
  Eye,
  EyeOff,
  Key,
  Monitor,
  Palette,
  Shield,
  Trash,
  User,
  Wallet,
  Workflow,
  X,
  Zap,
} from 'lucide-react';
import { useUserRole } from '../../contexts/EnhancedUserRoleContext';
import { useLLM } from '../../contexts/LLMContext';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { UserProfile } from '../auth/UserProfile';
import { EnhancedRoleSelector } from '../ui/EnhancedRoleSelector';
import { storage, STORAGE_KEYS } from '../../utils/storage';
import { showSuccess, showError } from '../../utils/toast';
import { apiClient } from '../../utils/api-client';
import { feedbackApi, type TrainingConsent } from '../../services/feedbackApi';
import { preferencesApi } from '../../services/preferencesApi';
import { securityApi } from '../../services/securityApi';
import { subscriptionsApi, type CurrentSubscription, type UsageResponse } from '../../services/subscriptionsApi';
import { PRODUCT_LABELS } from '../../constants/product';
import {
  DEFAULT_MULTIMODAL_SETTINGS,
  MODALITY_CAPABILITIES,
  MULTIMODAL_PROCESSING_MODES,
  MULTIMODAL_PROVIDER_PROFILES,
  PROVIDER_SUPPORT_LABELS,
  getProviderDisplayName,
  normalizeMultimodalSettings,
  type ModalityCapabilityId,
  type MultimodalProcessingMode,
  type MultimodalSettings,
  type ProviderKey,
  type ProviderPreference,
  type ProviderSupportLevel,
} from '../../constants/modalities';
import {
  CREATIVE_API_PROVIDER_FIELDS,
  EMPTY_CREATIVE_API_KEYS,
  type CreativeApiKeySlot,
} from '../../constants/creativeApiKeys';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: SettingsTab;
}

type SettingsTab = 'workspace' | 'models' | 'data' | 'security' | 'billing';

type ApiKeySlot = ProviderKey | Exclude<CreativeApiKeySlot, 'openai'>;

const API_PROVIDER_FIELDS: Array<{
  key: ProviderKey;
  label: string;
  placeholder: string;
  description: string;
  keyUrl: string;
  keyUrlLabel: string;
  models: string;
}> = [
  {
    key: 'openai',
    label: 'OpenAI',
    placeholder: 'sk-...',
    description:
      'Chat, GPT-4o, and Creative AI (GPT Image) via Generation Profiles. One key powers both.',
    keyUrl: 'https://platform.openai.com/api-keys',
    keyUrlLabel: 'platform.openai.com/api-keys',
    models: 'GPT-4o · GPT Image · GPT-4 Turbo · GPT-3.5',
  },
  {
    key: 'anthropic',
    label: 'Anthropic',
    placeholder: 'sk-ant-...',
    description: 'Unlocks Claude 3.5 Sonnet, Claude 3 Opus, and Claude Haiku.',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    keyUrlLabel: 'console.anthropic.com/settings/keys',
    models: 'Claude 3.5 Sonnet · Claude 3 Opus · Claude Haiku',
  },
  {
    key: 'groq',
    label: 'Groq',
    placeholder: 'gsk_...',
    description: 'Ultra-fast inference for open-source models. Free tier available with generous limits.',
    keyUrl: 'https://console.groq.com/keys',
    keyUrlLabel: 'console.groq.com/keys',
    models: 'Llama 3.3 · Mixtral · Gemma 2 · Qwen',
  },
  {
    key: 'cohere',
    label: 'Cohere',
    placeholder: '...',
    description: 'Used for RAG embeddings (embed-english-v3.0). Also supports text generation models.',
    keyUrl: 'https://dashboard.cohere.com/api-keys',
    keyUrlLabel: 'dashboard.cohere.com/api-keys',
    models: 'Command R+ · Command R · Embed v3',
  },
];

const TABS: Array<{ id: SettingsTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'workspace', label: 'Workspace', icon: User },
  { id: 'models', label: 'AI & Models', icon: Zap },
  { id: 'data', label: 'Knowledge & Data', icon: Database },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'billing', label: 'Plan & Usage', icon: CreditCard },
];

const formatNumber = (value?: number | null) => new Intl.NumberFormat().format(value ?? 0);
const formatCurrency = (cents?: number | null) => `$${((cents ?? 0) / 100).toFixed(2)}`;

function SummaryCard({
  title,
  value,
  helper,
  icon: Icon,
}: {
  title: string;
  value: string;
  helper: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">{title}</p>
          <p className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">{value}</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{helper}</p>
        </div>
        <div className="rounded-xl bg-gray-100 p-2 text-joa-primary dark:bg-gray-800">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
        {description ? <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function SettingsPanel({ isOpen, onClose, initialTab }: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab ?? 'workspace');

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);
  const { workspaceMode, getRoleConfig, backendRole, subscriptionTier, permissions, limits } = useUserRole();
  const { parameters, setParameters, isStreaming, setIsStreaming } = useLLM();
  const { user, changePassword, logout } = useAuth();
  const { setTheme } = useTheme();

  const [isBusy, setIsBusy] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [deletePassword, setDeletePassword] = useState('');

  const [selectedTheme, setSelectedTheme] = useState<'light' | 'dark' | 'auto'>('light');
  const [selectedFontSize, setSelectedFontSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(false);

  const [apiKeys, setApiKeys] = useState<Record<ApiKeySlot, string>>({
    openai: '',
    anthropic: '',
    groq: '',
    cohere: '',
    ollama: '',
    ...EMPTY_CREATIVE_API_KEYS,
  });
  const [showKeys, setShowKeys] = useState<Record<ApiKeySlot, boolean>>({
    openai: false,
    anthropic: false,
    groq: false,
    cohere: false,
    ollama: false,
    google_imagen: false,
    flux: false,
    ideogram: false,
    stability: false,
    adobe_firefly: false,
  });
  const [keyStatus, setKeyStatus] = useState<Record<ApiKeySlot, 'none' | 'valid' | 'invalid'>>({
    openai: 'none',
    anthropic: 'none',
    groq: 'none',
    cohere: 'none',
    ollama: 'none',
    google_imagen: 'none',
    flux: 'none',
    ideogram: 'none',
    stability: 'none',
    adobe_firefly: 'none',
  });
  const [multimodalSettings, setMultimodalSettings] = useState<MultimodalSettings>(DEFAULT_MULTIMODAL_SETTINGS);

  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [securitySummary, setSecuritySummary] = useState<Awaited<ReturnType<typeof securityApi.getSecuritySettings>> | null>(null);
  const [sessions, setSessions] = useState<Awaited<ReturnType<typeof securityApi.getSessions>>['sessions']>([]);
  const [subscription, setSubscription] = useState<CurrentSubscription | null>(null);
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [isStartingCheckout, setIsStartingCheckout] = useState(false);
  const [googleWorkspaceConnected, setGoogleWorkspaceConnected] = useState(false);
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [isDisconnectingGoogle, setIsDisconnectingGoogle] = useState(false);
  const [trainingConsent, setTrainingConsent] = useState<TrainingConsent | null>(null);
  const [isTrainingConsentLoading, setIsTrainingConsentLoading] = useState(false);
  const [isTrainingConsentSaving, setIsTrainingConsentSaving] = useState(false);

  const roleConfig = getRoleConfig();

  const getErrorMessage = (error: unknown, fallback: string) => {
    if (!error || typeof error !== 'object') {
      return fallback;
    }

    const maybeError = error as { message?: unknown; details?: unknown };
    if (typeof maybeError.message === 'string' && maybeError.message.trim()) {
      return maybeError.message;
    }

    if (maybeError.details && typeof maybeError.details === 'object') {
      const details = maybeError.details as { message?: unknown; error?: unknown };
      if (typeof details.message === 'string' && details.message.trim()) {
        return details.message;
      }
      if (typeof details.error === 'string' && details.error.trim()) {
        return details.error;
      }
    }

    return fallback;
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const loadSettings = async () => {
      const results = await Promise.allSettled([
        apiClient.get<{ apiKeys?: Partial<Record<ApiKeySlot, string>> }>('/api/users/settings/api-keys', { showErrorToast: false }),
        apiClient.get<{ preferences: Awaited<ReturnType<typeof preferencesApi.getPreferences>> }>('/api/preferences', { showErrorToast: false }),
        apiClient.get<{ security: Awaited<ReturnType<typeof securityApi.getSecuritySettings>> }>('/api/security', { showErrorToast: false }),
        apiClient.get<Awaited<ReturnType<typeof securityApi.getSessions>>>('/api/security/sessions', { showErrorToast: false }),
        apiClient.get<CurrentSubscription>('/api/subscriptions/current', { showErrorToast: false }),
        apiClient.get<UsageResponse>('/api/subscriptions/usage?days=30', { showErrorToast: false }),
      ]);

      const [keysResult, prefsResult, securityResult, sessionsResult, subscriptionResult, usageResult] = results;
      const issues: string[] = [];

      if (keysResult.status === 'fulfilled' && keysResult.value.apiKeys) {
        const loaded = keysResult.value.apiKeys;
        setApiKeys((previous) => ({ ...previous, ...loaded }));
        setKeyStatus((previous) => {
          const next = { ...previous };
          (Object.keys(previous) as ApiKeySlot[]).forEach((slot) => {
            if (loaded[slot]) next[slot] = 'valid';
          });
          return next;
        });
      } else if (keysResult.status === 'rejected') {
        issues.push(`API keys: ${getErrorMessage(keysResult.reason, 'Unavailable')}`);
      }

      if (prefsResult.status === 'fulfilled') {
        const prefsResponse = prefsResult.value.preferences;
        setSelectedTheme(prefsResponse.theme);
        setSelectedFontSize(prefsResponse.fontSize);
        setEmailNotifications(prefsResponse.emailNotifications);
        setPushNotifications(prefsResponse.pushNotifications);
        setMultimodalSettings(normalizeMultimodalSettings(prefsResponse.multimodalSettings));
        setPreferencesLoaded(true);
      } else {
        issues.push(`Preferences: ${getErrorMessage(prefsResult.reason, 'Unavailable')}`);
      }

      if (securityResult.status === 'fulfilled') {
        const securityResponse = securityResult.value.security;
        setSecuritySummary(securityResponse);
        setIs2FAEnabled(securityResponse.twoFactorEnabled);
      } else {
        issues.push(`Security: ${getErrorMessage(securityResult.reason, 'Unavailable')}`);
      }

      if (sessionsResult.status === 'fulfilled') {
        setSessions(sessionsResult.value.sessions ?? []);
      } else {
        issues.push(`Sessions: ${getErrorMessage(sessionsResult.reason, 'Unavailable')}`);
      }

      if (subscriptionResult.status === 'fulfilled') {
        setSubscription(subscriptionResult.value);
      }

      if (usageResult.status === 'fulfilled') {
        setUsage(usageResult.value);
      }

      // Load connected integrations
      try {
        const integrationsResult = await apiClient.get<{ integrations: Array<{ provider: string }> }>('/api/integrations', { showErrorToast: false });
        setGoogleWorkspaceConnected(
          integrationsResult.integrations.some((i) => i.provider === 'google_workspace'),
        );
      } catch {
        // Non-critical — silently ignore
      }

      // Handle OAuth callback redirect params
      const params = new URLSearchParams(window.location.search);
      if (params.get('integration') === 'success' && params.get('provider') === 'google_workspace') {
        setGoogleWorkspaceConnected(true);
        showSuccess('Google Workspace connected');
        window.history.replaceState({}, '', window.location.pathname);
      } else if (params.get('integration') === 'error') {
        showError('Google Workspace connection failed', params.get('reason') ?? 'Unknown error');
        window.history.replaceState({}, '', window.location.pathname);
      }

      const savedKeys = storage.getSecure<Record<ProviderKey, string>>(STORAGE_KEYS.API_KEYS);
      if ((!keysResult || keysResult.status === 'rejected') && savedKeys) {
        setApiKeys(savedKeys);
        setKeyStatus({
          openai: savedKeys.openai ? 'valid' : 'none',
          anthropic: savedKeys.anthropic ? 'valid' : 'none',
          groq: savedKeys.groq ? 'valid' : 'none',
          cohere: savedKeys.cohere ? 'valid' : 'none',
          ollama: savedKeys.ollama ? 'valid' : 'none',
        });
      }

      if (issues.length > 0) {
        console.error('Settings loaded with partial failures:', issues);
        showError('Some settings could not be loaded', issues.join(' | '));
      }
    };

    void loadSettings();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || activeTab !== 'data') {
      return;
    }

    let cancelled = false;

    const loadTrainingConsent = async () => {
      setIsTrainingConsentLoading(true);
      try {
        const consent = await feedbackApi.getConsent();
        if (!cancelled) {
          setTrainingConsent(consent);
        }
      } catch {
        if (!cancelled) {
          showError('Could not load training preference');
        }
      } finally {
        if (!cancelled) {
          setIsTrainingConsentLoading(false);
        }
      }
    };

    void loadTrainingConsent();

    return () => {
      cancelled = true;
    };
  }, [activeTab, isOpen]);

  const planLabel = useMemo(() => {
    const tier = subscription?.tier ?? 'free';
    return tier.charAt(0).toUpperCase() + tier.slice(1);
  }, [subscription]);

  const connectGoogleWorkspace = async () => {
    setIsConnectingGoogle(true);
    try {
      const { url } = await apiClient.get<{ url: string }>('/api/integrations/google/connect');
      window.location.href = url;
    } catch (error) {
      showError('Could not start Google Workspace connection', getErrorMessage(error, 'Please try again'));
      setIsConnectingGoogle(false);
    }
  };

  const disconnectGoogleWorkspace = async () => {
    setIsDisconnectingGoogle(true);
    try {
      await apiClient.delete('/api/integrations/google');
      setGoogleWorkspaceConnected(false);
      showSuccess('Google Workspace disconnected');
    } catch (error) {
      showError('Could not disconnect', getErrorMessage(error, 'Please try again'));
    } finally {
      setIsDisconnectingGoogle(false);
    }
  };

  const startProCheckout = async () => {
    setIsStartingCheckout(true);
    try {
      const { checkoutUrl } = await subscriptionsApi.createCheckout();
      window.open(checkoutUrl, '_blank', 'noopener,noreferrer');
      showSuccess('Checkout opened in a new tab');
    } catch (error) {
      showError(getErrorMessage(error, 'Could not start checkout'));
    } finally {
      setIsStartingCheckout(false);
    }
  };

  const handleApiKeyChange = (provider: ApiKeySlot, value: string) => {
    setApiKeys((previous) => ({ ...previous, [provider]: value }));
    if (!value) {
      setKeyStatus((previous) => ({ ...previous, [provider]: 'none' }));
      return;
    }
    // Soft format check — creative vendors vary; accept any non-trivial secret
    if (value.trim().length >= 8) {
      setKeyStatus((previous) => ({ ...previous, [provider]: 'valid' }));
    } else {
      setKeyStatus((previous) => ({ ...previous, [provider]: 'invalid' }));
    }
  };

  const toggleKeyVisibility = (provider: ApiKeySlot) => {
    setShowKeys((previous) => ({ ...previous, [provider]: !previous[provider] }));
  };

  const toggleCapabilityEnabled = (capabilityId: ModalityCapabilityId) => {
    setMultimodalSettings((previous) => {
      const enabledCapabilities = previous.enabledCapabilities.includes(capabilityId)
        ? previous.enabledCapabilities.filter((item) => item !== capabilityId)
        : [...previous.enabledCapabilities, capabilityId];

      return {
        ...previous,
        enabledCapabilities,
      };
    });
  };

  const updateRoutingPreference = (
    capabilityId: ModalityCapabilityId,
    patch: Partial<{
      primaryProvider: ProviderPreference;
      processingMode: MultimodalProcessingMode;
    }>,
  ) => {
    setMultimodalSettings((previous) => ({
      ...previous,
      routing: {
        ...previous.routing,
        [capabilityId]: {
          ...previous.routing[capabilityId],
          ...patch,
          fallbackProviders: previous.routing[capabilityId].fallbackProviders.filter(
            (provider) => provider !== (patch.primaryProvider ?? previous.routing[capabilityId].primaryProvider),
          ),
        },
      },
    }));
  };

  const toggleFallbackProvider = (capabilityId: ModalityCapabilityId, provider: ProviderKey) => {
    setMultimodalSettings((previous) => {
      if (previous.routing[capabilityId].primaryProvider === provider) {
        return previous;
      }

      const currentFallbacks = previous.routing[capabilityId].fallbackProviders;
      const fallbackProviders = currentFallbacks.includes(provider)
        ? currentFallbacks.filter((item) => item !== provider)
        : [...currentFallbacks, provider];

      return {
        ...previous,
        routing: {
          ...previous.routing,
          [capabilityId]: {
            ...previous.routing[capabilityId],
            fallbackProviders,
          },
        },
      };
    });
  };

  const getConnectionState = (provider: ProviderKey): 'Configured' | 'Needs key' | 'Platform only' => {
    const profile = MULTIMODAL_PROVIDER_PROFILES.find((item) => item.key === provider);
    if (profile && !profile.supportsByok) {
      return 'Platform only';
    }

    return apiKeys[provider] ? 'Configured' : 'Needs key';
  };

  const supportTone = (level: ProviderSupportLevel) => {
    switch (level) {
      case 'native':
        return 'border-emerald-200 bg-emerald-50 text-emerald-700';
      case 'assisted':
        return 'border-amber-200 bg-amber-50 text-amber-700';
      case 'planned':
        return 'border-slate-200 bg-slate-100 text-slate-600';
      default:
        return 'border-gray-200 bg-gray-100 text-gray-500';
    }
  };

  const handleChangePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      showError('New passwords do not match');
      return;
    }
    if (passwordData.newPassword.length < 8) {
      showError('Password must be at least 8 characters');
      return;
    }

    try {
      setIsBusy(true);
      await changePassword(passwordData.currentPassword, passwordData.newPassword);
      showSuccess('Password changed successfully');
      setIsChangingPassword(false);
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      showError(error.message || 'Failed to change password');
    } finally {
      setIsBusy(false);
    }
  };

  const handleExportData = async () => {
    try {
      const response = await apiClient.get('/api/users/settings/export');
      const blob = new Blob([JSON.stringify(response, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `joallm-data-export-${Date.now()}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      showSuccess('Data exported successfully');
    } catch (error: any) {
      showError(error?.message || 'Failed to export data');
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      showError('Please enter your password');
      return;
    }
    if (!confirm('Are you absolutely sure? This action cannot be undone. All your data will be permanently deleted.')) {
      return;
    }

    try {
      setIsBusy(true);
      await apiClient.delete('/api/auth/account', { password: deletePassword });
      showSuccess('Account deleted successfully. Logging you out...');
      setTimeout(async () => {
        await logout();
      }, 1500);
    } catch (error: any) {
      showError(error.message || 'Failed to delete account');
    } finally {
      setIsBusy(false);
      setIsDeletingAccount(false);
      setDeletePassword('');
    }
  };

  const handleTrainingConsentToggle = async () => {
    if (!trainingConsent || isTrainingConsentSaving) {
      return;
    }

    const previousConsent = trainingConsent;
    const nextConsentGiven = !trainingConsent.consentGiven;

    setTrainingConsent({
      ...trainingConsent,
      consentGiven: nextConsentGiven,
      givenAt: nextConsentGiven ? trainingConsent.givenAt ?? new Date().toISOString() : null,
    });
    setIsTrainingConsentSaving(true);

    try {
      const updatedConsent = await feedbackApi.updateConsent(nextConsentGiven);
      setTrainingConsent(updatedConsent);
      showSuccess(nextConsentGiven ? 'Training preference enabled' : 'Training preference disabled');
    } catch {
      setTrainingConsent(previousConsent);
      showError('Failed to update training preference');
    } finally {
      setIsTrainingConsentSaving(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      setIsBusy(true);
      await apiClient.put('/api/users/settings/api-keys', { apiKeys });
      await preferencesApi.updatePreferences({
        theme: selectedTheme,
        fontSize: selectedFontSize,
        emailNotifications,
        pushNotifications,
        workspaceMode,
        streamingEnabled: isStreaming,
        defaultTemperature: parameters.temperature,
        defaultMaxTokens: parameters.maxTokens,
        multimodalSettings,
      });

      if (selectedTheme !== 'auto') {
        setTheme(selectedTheme);
      }

      storage.setSecure(STORAGE_KEYS.API_KEYS, apiKeys);
      storage.set(STORAGE_KEYS.USER_ROLE, workspaceMode);
      storage.set(STORAGE_KEYS.THEME, selectedTheme);
      storage.set(STORAGE_KEYS.SETTINGS, { parameters, isStreaming, multimodalSettings });

      showSuccess('Settings saved successfully');
      onClose();
    } catch (error) {
      console.error('Failed to save settings:', error);
      showError('Failed to save settings. Please try again.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleRevokeSession = async (token: string) => {
    try {
      await securityApi.revokeSession(token);
      setSessions((previous) => previous.filter((session) => session.token !== token));
      showSuccess('Session revoked');
    } catch (error: any) {
      showError(error?.message || 'Failed to revoke session');
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="workspace-modal-wide flex h-[88vh] flex-col overflow-hidden rounded-3xl bg-gray-50 shadow-2xl dark:bg-gray-950">
        <div className="border-b border-gray-200 bg-white px-6 py-5 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-joa-primary">Account & Workspace</p>
              <h2 className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">Settings</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Align your workspace with how the backend already understands identity, security, models, and usage.
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-xl p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              title="Workspace Mode"
              value={roleConfig.name}
              helper="Current UI emphasis and defaults"
              icon={User}
            />
            <SummaryCard
              title="Plan"
              value={planLabel}
              helper={subscription ? 'Loaded from backend subscriptions' : 'Defaulting to free access'}
              icon={Wallet}
            />
            <SummaryCard
              title="Default Response Mode"
              value={isStreaming ? 'Streaming on' : 'Streaming off'}
              helper={`Temp ${parameters.temperature} • Max ${parameters.maxTokens}`}
              icon={Zap}
            />
            <SummaryCard
              title="Security"
              value={is2FAEnabled ? '2FA enabled' : '2FA not enabled'}
              helper={securitySummary?.lastLoginAt ? `Last login ${new Date(securitySummary.lastLoginAt).toLocaleString()}` : 'Security status loaded from backend'}
              icon={Shield}
            />
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          <aside className="w-full border-r border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 md:w-72">
            <nav className="space-y-2">
              {TABS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors ${
                    activeTab === id
                      ? 'bg-joa-primary text-white'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">{label}</span>
                </button>
              ))}
            </nav>
          </aside>

          <div className="min-h-0 flex-1 overflow-y-auto p-6">
            {activeTab === 'workspace' && (
              <div className="space-y-6">
                <SectionCard
                  title="Profile & Access"
                  description="Identity, workspace mode, and how this account is currently represented in the product."
                >
                  <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
                    <div>
                      <UserProfile />
                    </div>
                    <div className="space-y-4">
                      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <h4 className="font-medium text-gray-900 dark:text-white">Role & Workspace Mode</h4>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                              Workspace mode shapes the frontend experience. Backend role, permissions, and plan determine actual access.
                            </p>
                          </div>
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-700 dark:bg-gray-900 dark:text-gray-300">
                            {roleConfig.name}
                          </span>
                        </div>
                        <div className="mt-4">
                          <EnhancedRoleSelector />
                        </div>
                      </div>
                      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                        <h4 className="font-medium text-gray-900 dark:text-white">Current Access Snapshot</h4>
                        <div className="mt-3 space-y-3">
                          <div className="grid gap-2 sm:grid-cols-2">
                            <div className="rounded-xl bg-white px-3 py-2 text-sm text-gray-700 dark:bg-gray-900 dark:text-gray-300">
                              Backend role: <span className="font-medium capitalize">{backendRole}</span>
                            </div>
                            <div className="rounded-xl bg-white px-3 py-2 text-sm text-gray-700 dark:bg-gray-900 dark:text-gray-300">
                              Subscription: <span className="font-medium capitalize">{subscriptionTier}</span>
                            </div>
                          </div>
                          <div className="rounded-xl bg-white px-3 py-3 text-sm text-gray-700 dark:bg-gray-900 dark:text-gray-300">
                            <div className="mb-2 font-medium text-gray-900 dark:text-white">Permissions</div>
                            <div className="flex flex-wrap gap-2">
                              {permissions.length > 0 ? (
                                permissions.map((permission) => (
                                  <span
                                    key={permission}
                                    className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                                  >
                                    {permission}
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs text-gray-500 dark:text-gray-400">Access snapshot is still loading.</span>
                              )}
                            </div>
                          </div>
                          {limits ? (
                            <div className="grid gap-2 sm:grid-cols-2">
                              <div className="rounded-xl bg-white px-3 py-2 text-sm text-gray-700 dark:bg-gray-900 dark:text-gray-300">
                                Max notebooks: <span className="font-medium">{formatNumber(limits.maxNotebooks)}</span>
                              </div>
                              <div className="rounded-xl bg-white px-3 py-2 text-sm text-gray-700 dark:bg-gray-900 dark:text-gray-300">
                                Max workflows: <span className="font-medium">{formatNumber(limits.maxWorkflows)}</span>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                </SectionCard>

                <SectionCard title="Appearance & Notifications" description="Workspace preferences backed by the preferences domain.">
                  <div className="grid gap-6 lg:grid-cols-2">
                    <div className="space-y-4">
                      <div>
                        <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                          <Palette className="h-4 w-4" />
                          Theme
                        </label>
                        <select
                          value={selectedTheme}
                          onChange={(event) => setSelectedTheme(event.target.value as 'light' | 'dark' | 'auto')}
                          className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                        >
                          <option value="light">Light</option>
                          <option value="dark">Dark</option>
                          <option value="auto">Auto</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                          <BookOpen className="h-4 w-4" />
                          Font Size
                        </label>
                        <select
                          value={selectedFontSize}
                          onChange={(event) => setSelectedFontSize(event.target.value as 'small' | 'medium' | 'large')}
                          className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                        >
                          <option value="small">Small</option>
                          <option value="medium">Medium</option>
                          <option value="large">Large</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-white">Email Notifications</h4>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Receive activity and account updates by email.</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={emailNotifications}
                          onChange={(event) => setEmailNotifications(event.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600"
                        />
                      </div>
                      <div className="flex items-center justify-between rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-white">Push Notifications</h4>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Keep time-sensitive alerts visible in the browser.</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={pushNotifications}
                          onChange={(event) => setPushNotifications(event.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600"
                        />
                      </div>
                      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                        <div className="flex items-center gap-2 font-medium text-gray-800 dark:text-gray-200">
                          <Monitor className="h-4 w-4" />
                          Preferences sync status
                        </div>
                        <p className="mt-2">
                          {preferencesLoaded ? 'Preferences loaded from the backend preferences domain.' : 'Preferences will load when the panel opens.'}
                        </p>
                      </div>
                    </div>
                  </div>
                </SectionCard>
              </div>
            )}

            {activeTab === 'models' && (
              <div className="space-y-6">
                <SectionCard
                  title="Provider Keys"
                  description="Encrypted API keys that power chat, multimodal routing, and Creative AI Generation Profiles (BYOK)."
                >
                  {!limits?.canUseCustomApiKeys ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                      <div className="flex items-start gap-3">
                        <Key className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                        <div>
                          <p className="font-semibold text-amber-900">Custom API keys require Pro</p>
                          <p className="mt-1 text-sm text-amber-800">
                            On the free plan, all requests use the platform's shared API keys. Upgrade to Pro to supply your own keys and bypass platform quotas.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Keys are encrypted before storage and never exposed in responses. Your key is used instead of the platform key, so your own provider quotas and billing apply.
                      </p>
                      {API_PROVIDER_FIELDS.map(({ key, label, placeholder, description, keyUrl, keyUrlLabel, models }) => (
                        <div key={key} className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
                          <div className="mb-3 flex items-start justify-between gap-4">
                            <div>
                              <p className="font-semibold text-gray-900 dark:text-white">{label}</p>
                              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{description}</p>
                              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">Models: {models}</p>
                            </div>
                            <a
                              href={keyUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300"
                            >
                              Get key →
                            </a>
                          </div>
                          <div className="space-y-1.5">
                            <div className="relative">
                              <input
                                type={showKeys[key] ? 'text' : 'password'}
                                value={apiKeys[key]}
                                onChange={(event) => handleApiKeyChange(key, event.target.value)}
                                placeholder={placeholder}
                                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 pr-11 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                              />
                              <button
                                type="button"
                                onClick={() => toggleKeyVisibility(key)}
                                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 transition-colors hover:text-gray-600"
                              >
                                {showKeys[key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                            </div>
                            <p className="text-xs text-gray-400 dark:text-gray-500">
                              {keyUrlLabel}
                            </p>
                            <div className="flex items-center gap-2 text-sm">
                              {keyStatus[key] === 'valid' ? (
                                <span className="flex items-center gap-1 text-green-600">
                                  <CheckCircle className="h-4 w-4" />
                                  Valid format
                                </span>
                              ) : null}
                              {keyStatus[key] === 'invalid' ? (
                                <span className="flex items-center gap-1 text-red-600">
                                  <AlertCircle className="h-4 w-4" />
                                  Invalid format — check the key prefix
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </SectionCard>

                <SectionCard
                  title="Creative AI providers"
                  description="BYOK for Marketing Studio Generation Profiles. Studio picks Style + Quality + Auto; Platform Creative AI uses these keys. OpenAI above already covers GPT Image."
                >
                  {!limits?.canUseCustomApiKeys ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-300">
                      Upgrade to Pro to attach Ideogram, Imagen, FLUX, and other Creative AI keys. Until then, platform defaults apply when configured.
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Same encrypted store as chat keys. Marketing Studio never calls vendors directly — Generation Profiles resolve through Creative AI.
                      </p>
                      {CREATIVE_API_PROVIDER_FIELDS.map(
                        ({ key, label, placeholder, description, keyUrl, keyUrlLabel, strengths }) => (
                          <div
                            key={key}
                            className="rounded-2xl border border-teal-200/80 bg-teal-50/40 p-4 dark:border-teal-900/50 dark:bg-teal-950/20"
                          >
                            <div className="mb-3 flex items-start justify-between gap-4">
                              <div>
                                <p className="font-semibold text-gray-900 dark:text-white">{label}</p>
                                <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{description}</p>
                                <p className="mt-1 text-xs text-teal-800/80 dark:text-teal-200/80">{strengths}</p>
                              </div>
                              <a
                                href={keyUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="shrink-0 rounded-lg border border-teal-300 bg-white px-3 py-1.5 text-xs font-medium text-teal-900 transition hover:bg-teal-50 dark:border-teal-800 dark:bg-gray-900 dark:text-teal-100"
                              >
                                Get key →
                              </a>
                            </div>
                            <div className="relative">
                              <input
                                type={showKeys[key] ? 'text' : 'password'}
                                value={apiKeys[key]}
                                onChange={(event) => handleApiKeyChange(key, event.target.value)}
                                placeholder={placeholder}
                                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 pr-11 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                              />
                              <button
                                type="button"
                                onClick={() => toggleKeyVisibility(key)}
                                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 transition-colors hover:text-gray-600"
                              >
                                {showKeys[key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                            </div>
                            <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">{keyUrlLabel}</p>
                            {keyStatus[key] === 'valid' ? (
                              <span className="mt-2 inline-flex items-center gap-1 text-sm text-green-600">
                                <CheckCircle className="h-4 w-4" />
                                Saved when you click Save
                              </span>
                            ) : null}
                          </div>
                        ),
                      )}
                    </div>
                  )}
                </SectionCard>

                <SectionCard
                  title="Provider Capability Map"
                  description="A planning view of which providers fit each modality, so teams can route work deliberately instead of treating everything as generic text generation."
                >
                  <div className="grid gap-4 xl:grid-cols-2">
                    {MULTIMODAL_PROVIDER_PROFILES.map((provider) => (
                      <div key={provider.key} className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-gray-900 dark:text-white">{provider.label}</p>
                              <span className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
                                {getConnectionState(provider.key)}
                              </span>
                            </div>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{provider.description}</p>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {provider.strengths.map((strength) => (
                            <span
                              key={strength}
                              className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                            >
                              {strength}
                            </span>
                          ))}
                        </div>

                        <div className="mt-4 grid gap-2 sm:grid-cols-2">
                          {MODALITY_CAPABILITIES.map((capability) => (
                            <div
                              key={capability.id}
                              className="flex items-center justify-between rounded-xl border border-white/60 bg-white/70 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900/70"
                            >
                              <span className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
                                <capability.icon className="h-4 w-4" />
                                {capability.shortLabel}
                              </span>
                              <span
                                className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] ${supportTone(
                                  provider.modalitySupport[capability.id],
                                )}`}
                              >
                                {PROVIDER_SUPPORT_LABELS[provider.modalitySupport[capability.id]]}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </SectionCard>

                <SectionCard
                  title="Multimodal Routing Defaults"
                  description="Define which provider and processing path each modality should prefer when users work in chat, notebooks, and workflows."
                >
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                      These defaults shape the UI and provider intent for multimodal work. When a custom key is not available, JoaLLM can fall back to the platform default or the fallback chain you define here.
                    </div>

                    {MODALITY_CAPABILITIES.map((capability) => {
                      const routing = multimodalSettings.routing[capability.id];
                      const enabled = multimodalSettings.enabledCapabilities.includes(capability.id);

                      return (
                        <div key={capability.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
                          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                            <div className="max-w-xl">
                              <div className="flex flex-wrap items-center gap-3">
                                <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${capability.accentClass}`}>
                                  <capability.icon className="h-4 w-4" />
                                  {capability.label}
                                </span>
                                <button
                                  type="button"
                                  role="switch"
                                  aria-checked={enabled}
                                  onClick={() => toggleCapabilityEnabled(capability.id)}
                                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                                    enabled ? 'bg-joa-primary' : 'bg-gray-300 dark:bg-gray-600'
                                  }`}
                                >
                                  <span
                                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                                      enabled ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                                  />
                                </button>
                              </div>
                              <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">{capability.description}</p>
                              <p className="mt-2 text-xs uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                                Example flows: {capability.examples.join(' · ')}
                              </p>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2 xl:min-w-[420px]">
                              <div>
                                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                                  Primary provider
                                </label>
                                <select
                                  value={routing.primaryProvider}
                                  onChange={(event) =>
                                    updateRoutingPreference(capability.id, {
                                      primaryProvider: event.target.value as ProviderPreference,
                                    })
                                  }
                                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                >
                                  <option value="platform_default">Platform Default</option>
                                  {MULTIMODAL_PROVIDER_PROFILES.map((provider) => (
                                    <option key={provider.key} value={provider.key}>
                                      {provider.label}
                                      {provider.supportsByok ? '' : ' (platform-managed)'}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                                  Default processing
                                </label>
                                <select
                                  value={routing.processingMode}
                                  onChange={(event) =>
                                    updateRoutingPreference(capability.id, {
                                      processingMode: event.target.value as MultimodalProcessingMode,
                                    })
                                  }
                                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                >
                                  {MULTIMODAL_PROCESSING_MODES.map((mode) => (
                                    <option key={mode.id} value={mode.id}>
                                      {mode.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </div>

                          <div className="mt-4">
                            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                              Fallback chain
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {MULTIMODAL_PROVIDER_PROFILES.filter((provider) => provider.key !== routing.primaryProvider).map((provider) => {
                                const active = routing.fallbackProviders.includes(provider.key);
                                return (
                                  <button
                                    key={provider.key}
                                    type="button"
                                    onClick={() => toggleFallbackProvider(capability.id, provider.key)}
                                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                                      active
                                        ? 'border-joa-primary bg-teal-50 text-joa-primary'
                                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300'
                                    }`}
                                  >
                                    {provider.label}
                                  </button>
                                );
                              })}
                            </div>
                            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                              Current route: {getProviderDisplayName(routing.primaryProvider)}
                              {routing.fallbackProviders.length > 0
                                ? ` → ${routing.fallbackProviders.map((provider) => getProviderDisplayName(provider)).join(' → ')}`
                                : ' with no fallback providers yet'}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </SectionCard>

                <SectionCard title="Default Model Behavior" description="Preferences for how new conversations and tasks should behave by default.">
                  <div className="grid gap-6 lg:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Temperature: {parameters.temperature}
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="2"
                        step="0.1"
                        value={parameters.temperature}
                        onChange={(event) =>
                          setParameters((previous) => ({ ...previous, temperature: parseFloat(event.target.value) }))
                        }
                        className="w-full"
                      />
                      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                        Lower values stay closer to source intent. Higher values allow more variation.
                      </p>
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Max Tokens: {parameters.maxTokens}
                      </label>
                      <input
                        type="range"
                        min="100"
                        max="4000"
                        step="100"
                        value={parameters.maxTokens}
                        onChange={(event) =>
                          setParameters((previous) => ({ ...previous, maxTokens: parseInt(event.target.value, 10) }))
                        }
                        className="w-full"
                      />
                      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                        Use tighter limits for cost discipline and broader limits for synthesis-heavy tasks.
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white">Streaming Responses</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Show responses incrementally in chat and other AI surfaces.</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={isStreaming}
                        onChange={(event) => setIsStreaming(event.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600"
                      />
                    </div>
                  </div>
                </SectionCard>

                <SectionCard
                  title="Connected Apps"
                  description="Connect third-party services so the AI can read your emails, calendar, and files when answering questions. Requires Pro."
                >
                  {!limits?.canUseCustomApiKeys ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                      <div className="flex items-start gap-3">
                        <Key className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                        <div>
                          <p className="font-semibold text-amber-900">Connected apps require Pro</p>
                          <p className="mt-1 text-sm text-amber-800">
                            Upgrade to Pro to connect Google Workspace and let the AI read your Gmail, Calendar, and Drive.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-sm dark:bg-gray-900">
                              <svg className="h-5 w-5" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                              </svg>
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900 dark:text-white">Google Workspace</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {googleWorkspaceConnected
                                  ? 'Gmail · Calendar · Drive — read-only'
                                  : 'Gmail, Calendar, and Drive — read-only access'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {googleWorkspaceConnected && (
                              <span className="flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                <CheckCircle className="h-3 w-3" />
                                Connected
                              </span>
                            )}
                            {googleWorkspaceConnected ? (
                              <button
                                onClick={disconnectGoogleWorkspace}
                                disabled={isDisconnectingGoogle}
                                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-teal-50 hover:border-red-300 hover:text-teal-700 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300"
                              >
                                {isDisconnectingGoogle ? 'Disconnecting…' : 'Disconnect'}
                              </button>
                            ) : (
                              <button
                                onClick={connectGoogleWorkspace}
                                disabled={isConnectingGoogle}
                                className="rounded-lg bg-joa-primary px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                              >
                                {isConnectingGoogle ? 'Redirecting…' : 'Connect'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </SectionCard>
              </div>
            )}

            {activeTab === 'data' && (
              <div className="space-y-6">
                <SectionCard
                  title="Knowledge & Data Controls"
                  description="Export and retention-oriented actions that match backend user settings and account data flows."
                >
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                      <h4 className="font-medium text-gray-900 dark:text-white">Export Workspace Data</h4>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Download your chat history, files, settings, and linked account data as JSON.
                      </p>
                      <button
                        onClick={handleExportData}
                        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
                      >
                        <Download className="h-4 w-4" />
                        Export Data
                      </button>
                    </div>
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                      <h4 className="font-medium text-gray-900 dark:text-white">Data Footprint</h4>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <div className="rounded-xl bg-white px-3 py-2 text-sm text-gray-700 dark:bg-gray-900 dark:text-gray-300">
                          {formatNumber(subscription?.usage.totalFiles)} files tracked
                        </div>
                        <div className="rounded-xl bg-white px-3 py-2 text-sm text-gray-700 dark:bg-gray-900 dark:text-gray-300">
                          {formatNumber(subscription?.usage.totalRequests)} requests tracked
                        </div>
                      </div>
                      <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                        This reflects the backend subscription and usage stats currently available.
                      </p>
                    </div>
                  </div>
                </SectionCard>

                <SectionCard
                  title="Improve JoaLLM AI"
                  description="Control whether anonymised conversations and ratings may be used to improve future versions of JoaLLM."
                >
                  <div className="flex items-start justify-between gap-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                    <div className="min-w-0">
                      <h4 className="font-medium text-gray-900 dark:text-white">Help train JoaLLM&apos;s AI models</h4>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Your anonymised conversations and ratings may be used to improve future versions of JoaLLM. You can opt out at any time.
                      </p>
                      {trainingConsent?.consentGiven && trainingConsent.givenAt ? (
                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                          Opted in on {new Date(trainingConsent.givenAt).toLocaleString()}
                        </p>
                      ) : null}
                      {isTrainingConsentLoading ? (
                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Loading current preference...</p>
                      ) : null}
                    </div>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={trainingConsent?.consentGiven ?? false}
                      aria-label="Help train JoaLLM's AI models"
                      onClick={() => void handleTrainingConsentToggle()}
                      disabled={isTrainingConsentLoading || isTrainingConsentSaving || !trainingConsent}
                      className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors ${
                        trainingConsent?.consentGiven ? 'bg-joa-primary' : 'bg-gray-300 dark:bg-gray-600'
                      } ${(isTrainingConsentLoading || isTrainingConsentSaving || !trainingConsent) ? 'cursor-not-allowed opacity-60' : ''}`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                          trainingConsent?.consentGiven ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </SectionCard>

                <SectionCard
                  title="Danger Zone"
                  description="High-impact account actions. Keep these visually distinct from routine preferences."
                >
                  <div className="rounded-2xl border border-teal-200 bg-teal-50 p-4 dark:border-red-900 dark:bg-red-950/30">
                    <h4 className="font-medium text-red-900 dark:text-red-200">Delete Account</h4>
                    <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                      Permanently delete your account and all associated data. This cannot be undone.
                    </p>
                    {isDeletingAccount ? (
                      <div className="mt-4 space-y-3">
                        <input
                          type="password"
                          placeholder="Enter your password to confirm"
                          value={deletePassword}
                          onChange={(event) => setDeletePassword(event.target.value)}
                          className="w-full rounded-xl border border-red-300 bg-white px-3 py-2.5 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 dark:border-red-900 dark:bg-gray-900 dark:text-white"
                        />
                        <div className="flex gap-3">
                          <button
                            onClick={handleDeleteAccount}
                            disabled={isBusy}
                            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                          >
                            <Trash className="h-4 w-4" />
                            {isBusy ? 'Deleting...' : 'Confirm Delete'}
                          </button>
                          <button
                            onClick={() => {
                              setIsDeletingAccount(false);
                              setDeletePassword('');
                            }}
                            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setIsDeletingAccount(true)}
                        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-white transition-colors hover:bg-red-700"
                      >
                        <Trash className="h-4 w-4" />
                        Delete Account
                      </button>
                    )}
                  </div>
                </SectionCard>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="space-y-6">
                <SectionCard
                  title="Authentication & Protection"
                  description="Password, two-factor authentication, and current security posture from the backend security domain."
                >
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                      <h4 className="font-medium text-gray-900 dark:text-white">Change Password</h4>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Update your account password and rotate credentials when needed.</p>
                      {isChangingPassword ? (
                        <div className="mt-4 space-y-3">
                          <input
                            type="password"
                            placeholder="Current password"
                            value={passwordData.currentPassword}
                            onChange={(event) => setPasswordData((previous) => ({ ...previous, currentPassword: event.target.value }))}
                            className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                          />
                          <input
                            type="password"
                            placeholder="New password"
                            value={passwordData.newPassword}
                            onChange={(event) => setPasswordData((previous) => ({ ...previous, newPassword: event.target.value }))}
                            className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                          />
                          <input
                            type="password"
                            placeholder="Confirm new password"
                            value={passwordData.confirmPassword}
                            onChange={(event) => setPasswordData((previous) => ({ ...previous, confirmPassword: event.target.value }))}
                            className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                          />
                          <div className="flex gap-3">
                            <button
                              onClick={handleChangePassword}
                              disabled={isBusy}
                              className="rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                            >
                              {isBusy ? 'Changing...' : 'Change Password'}
                            </button>
                            <button
                              onClick={() => {
                                setIsChangingPassword(false);
                                setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                              }}
                              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setIsChangingPassword(true)}
                          className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
                        >
                          Change Password
                        </button>
                      )}
                    </div>

                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                      <h4 className="font-medium text-gray-900 dark:text-white">Two-Factor Authentication</h4>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Add another authentication factor to better protect your account.
                      </p>
                      <div className="mt-4 flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{is2FAEnabled ? 'Enabled' : 'Disabled'}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {is2FAEnabled ? 'Your account has additional protection enabled.' : 'Two-factor is available through the backend security domain.'}
                          </p>
                        </div>
                        <button
                          onClick={() => showError('2FA flow is not fully wired in the frontend yet.')}
                          className="rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
                        >
                          {is2FAEnabled ? 'Manage 2FA' : 'Enable 2FA'}
                        </button>
                      </div>
                    </div>
                  </div>
                </SectionCard>

                <SectionCard
                  title="Active Sessions"
                  description="Session visibility backed by the security API so users can see where their account is signed in."
                >
                  {sessions.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-gray-300 p-6 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                      No active sessions were returned by the backend.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {sessions.map((session) => (
                        <div
                          key={session.token}
                          className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800 lg:flex-row lg:items-center lg:justify-between"
                        >
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{session.device || 'Unknown device'}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {session.ip} • Last active {new Date(session.lastActive).toLocaleString()}
                            </p>
                          </div>
                          <button
                            onClick={() => handleRevokeSession(session.token)}
                            className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-600 transition-colors hover:bg-teal-50 dark:border-red-900 dark:hover:bg-red-950/30"
                          >
                            Revoke
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </SectionCard>
              </div>
            )}

            {activeTab === 'billing' && (
              <div className="space-y-6">
                <SectionCard
                  title="Current Plan"
                  description="This section is aligned to the backend subscriptions domain instead of frontend role labels."
                >
                  <div className="grid gap-4 lg:grid-cols-3">
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Tier</p>
                      <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{planLabel}</p>
                    </div>
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Tracked Requests</p>
                      <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">
                        {formatNumber(subscription?.usage.totalRequests)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Tracked Tokens</p>
                      <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">
                        {formatNumber(subscription?.usage.totalTokens)}
                      </p>
                    </div>
                  </div>

                  {subscription?.limits ? (
                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      {Object.entries(subscription.limits).map(([key, value]) => (
                        <div key={key} className="rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm dark:border-gray-700 dark:bg-gray-900">
                          <div className="font-medium text-gray-900 capitalize dark:text-white">{key.replace(/([A-Z])/g, ' $1')}</div>
                          <div className="mt-1 text-gray-500 dark:text-gray-400">{String(value)}</div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </SectionCard>

                <SectionCard
                  title="Usage Overview"
                  description="Recent usage and cost visibility from `/api/subscriptions/usage`."
                >
                  <div className="grid gap-4 lg:grid-cols-3">
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                        <Zap className="h-4 w-4" />
                        Requests
                      </div>
                      <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">
                        {formatNumber(usage?.totals.totalRequests)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                        <Workflow className="h-4 w-4" />
                        Tokens
                      </div>
                      <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">
                        {formatNumber(usage?.totals.totalTokens)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                        <CreditCard className="h-4 w-4" />
                        Estimated Cost
                      </div>
                      <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(usage?.totals.totalCostCents)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                    <h4 className="font-medium text-gray-900 dark:text-white">Recent model activity</h4>
                    {usage?.dailyBreakdown?.length ? (
                      <div className="mt-3 space-y-3">
                        {usage.dailyBreakdown.slice(0, 5).map((row) => (
                          <div key={row.date} className="flex flex-col gap-2 rounded-xl bg-white px-4 py-3 text-sm dark:bg-gray-900 lg:flex-row lg:items-center lg:justify-between">
                            <div className="font-medium text-gray-900 dark:text-white">{row.date}</div>
                            <div className="text-gray-500 dark:text-gray-400">
                              {formatNumber(row.totalRequests)} requests • {formatNumber(row.totalTokens)} tokens • {formatCurrency(row.totalCostCents)}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                        Usage data is not available yet for this account.
                      </p>
                    )}
                  </div>
                </SectionCard>

                {subscriptionTier === 'free' && (
                  <div className="rounded-3xl border-2 border-joa-primary bg-gradient-to-br from-teal-50 to-white p-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-semibold uppercase tracking-widest text-joa-primary">Pro — Founder's Offer</p>
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">Limited time</span>
                        </div>
                        <div className="mt-1 flex items-baseline gap-2">
                          <span className="text-2xl font-extrabold text-gray-900">$5<span className="text-base font-normal text-gray-500">/mo</span></span>
                          <span className="text-sm text-gray-400 line-through">$29/mo</span>
                          <span className="text-xs text-gray-500">· first 3 months</span>
                        </div>
                        <h3 className="mt-1.5 text-xl font-bold text-gray-900 dark:text-white">Remove limits. Keep your files.</h3>
                        <ul className="mt-3 space-y-1.5 text-sm text-gray-600 dark:text-gray-400">
                          <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 shrink-0 text-emerald-500" /> Original files stored permanently in cloud</li>
                          <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 shrink-0 text-emerald-500" /> 200 files · 5 GB storage · 2 000 requests/day</li>
                          <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 shrink-0 text-emerald-500" /> Custom LLM provider keys</li>
                          <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 shrink-0 text-emerald-500" /> Data export &amp; workflow management</li>
                        </ul>
                      </div>
                      <div className="shrink-0">
                        <button
                          type="button"
                          onClick={() => void startProCheckout()}
                          disabled={isStartingCheckout}
                          className="inline-flex items-center gap-2 rounded-xl bg-joa-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          <CreditCard className="h-4 w-4" />
                          {isStartingCheckout ? 'Opening checkout...' : 'Activate Pro'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-gray-200 bg-white px-6 py-4 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Settings now mirror backend domains: preferences, security, user settings, and subscriptions.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveSettings}
              disabled={isBusy}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {isBusy ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
