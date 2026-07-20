import { apiClient } from '../utils/api-client';

export interface SecuritySettings {
  id: string;
  userId: string;
  twoFactorEnabled: boolean;
  passwordChangedAt?: string;
  lastLoginAt?: string;
  lastLoginIp?: string;
  failedLoginAttempts: number;
  lockedUntil?: string;
  hasTwoFactorSecret: boolean;
  hasBackupCodes: boolean;
}

export interface Session {
  token: string;
  device: string;
  ip: string;
  lastActive: string;
}

export interface TwoFactorSetup {
  secret: string;
  qrCode: string;
  backupCodes: string[];
  message: string;
}

export const securityApi = {
  // Get security settings
  async getSecuritySettings(): Promise<SecuritySettings> {
    const response = await apiClient.get('/api/security');
    return response.security;
  },

  // Setup 2FA (Step 1)
  async setup2FA(password: string): Promise<TwoFactorSetup> {
    return await apiClient.post('/api/security/2fa/setup', { password });
  },

  // Enable 2FA (Step 2)
  async enable2FA(code: string): Promise<{ success: boolean; message: string }> {
    return await apiClient.post('/api/security/2fa/enable', { code });
  },

  // Disable 2FA
  async disable2FA(password: string, code: string): Promise<{ success: boolean; message: string }> {
    return await apiClient.post('/api/security/2fa/disable', { password, code });
  },

  // Verify 2FA code
  async verify2FA(code: string): Promise<{
    success: boolean;
    verified: boolean;
    usedBackupCode?: boolean;
    remainingBackupCodes?: number;
  }> {
    return await apiClient.post('/api/security/2fa/verify', { code });
  },

  // Get active sessions
  async getSessions(): Promise<{
    sessions: Session[];
    lastLogin?: string;
    lastLoginIp?: string;
  }> {
    return await apiClient.get('/api/security/sessions');
  },

  // Revoke session
  async revokeSession(sessionId: string): Promise<void> {
    await apiClient.delete(`/api/security/sessions/${sessionId}`);
  },
};

