import { apiClient } from '../utils/api-client';

export interface SubscriptionLimits {
  requestsPerDay?: number;
  maxFiles?: number;
  maxTokensPerMonth?: number;
  maxWorkflows?: number;
  [key: string]: unknown;
}

export interface SubscriptionUsageSummary {
  totalTokens: number;
  totalRequests: number;
  totalFiles: number;
  lastReset: string | null;
}

export interface CurrentSubscription {
  tier: 'free' | 'pro' | 'enterprise';
  limits: SubscriptionLimits;
  usage: SubscriptionUsageSummary;
}

export interface UsageTotals {
  totalRequests: number;
  totalTokens: number;
  totalCostCents: number;
}

export interface UsageResponse {
  days: number;
  dailyBreakdown: Array<{
    date: string;
    totalRequests: number;
    totalTokens: number;
    totalCostCents: number;
    models: string[];
  }>;
  totals: UsageTotals;
}

export interface CheckoutResponse {
  provider: 'razorpay' | 'lemonsqueezy';
  checkoutUrl: string;
}

export const subscriptionsApi = {
  async getCurrent(): Promise<CurrentSubscription> {
    return await apiClient.get('/api/subscriptions/current');
  },

  async getUsage(days = 30): Promise<UsageResponse> {
    return await apiClient.get(`/api/subscriptions/usage?days=${days}`, { showErrorToast: false });
  },

  async createCheckout(): Promise<CheckoutResponse> {
    return await apiClient.post('/api/subscriptions/checkout');
  },
};
