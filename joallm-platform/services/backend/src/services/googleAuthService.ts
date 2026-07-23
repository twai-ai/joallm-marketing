import { OAuth2Client } from 'google-auth-library';
import { config } from '../config/config.js';
import { logger } from '../utils/logger.js';
import { normalizePublicUrl } from '../utils/public-url.js';

export interface GoogleUserInfo {
  id: string;
  email: string;
  name: string;
  picture?: string;
  verified_email: boolean;
}

export class GoogleAuthService {
  private clientId: string;
  private clientSecret: string;
  private defaultRedirectUri: string;

  constructor() {
    this.clientId = config.googleClientId;
    this.clientSecret = config.googleClientSecret;
    this.defaultRedirectUri = normalizePublicUrl(
      config.googleRedirectUri,
      'http://localhost:3001/api/auth/google/callback',
    );
  }

  private createClient(redirectUri: string): OAuth2Client {
    return new OAuth2Client(this.clientId, this.clientSecret, redirectUri);
  }

  resolveRedirectUri(override?: string | null): string {
    return normalizePublicUrl(override || this.defaultRedirectUri, this.defaultRedirectUri);
  }

  /**
   * Generate Google OAuth URL for user to authorize
   */
  generateAuthUrl(redirectUri?: string): string {
    try {
      const resolvedRedirect = this.resolveRedirectUri(redirectUri);
      const client = this.createClient(resolvedRedirect);
      const scopes = [
        'openid',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
      ];

      const authUrl = client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        include_granted_scopes: true,
        prompt: 'select_account',
        redirect_uri: resolvedRedirect,
        // UX hint only — server still validates verified email via Organization Admission
        hd: process.env.GOOGLE_OAUTH_HD || 'atrisi.org',
      });

      logger.info('Generated Google OAuth URL', {
        clientId: this.clientId,
        redirectUri: resolvedRedirect,
        hasSecret: !!this.clientSecret && this.clientSecret !== 'PLACEHOLDER-GOOGLE-CLIENT-SECRET',
      });

      return authUrl;
    } catch (error) {
      logger.error('Failed to generate Google OAuth URL:', error);
      throw new Error('Failed to generate Google OAuth URL');
    }
  }

  /**
   * Exchange authorization code for tokens and get user info
   */
  async getTokenAndUserInfo(
    code: string,
    redirectUri?: string,
  ): Promise<{
    tokens: any;
    userInfo: GoogleUserInfo;
  }> {
    try {
      const resolvedRedirect = this.resolveRedirectUri(redirectUri);
      const client = this.createClient(resolvedRedirect);
      const { tokens } = await client.getToken({
        code,
        redirect_uri: resolvedRedirect,
      });
      client.setCredentials(tokens);

      // Prefer id_token (requires openid scope); fall back to userinfo endpoint
      if (tokens.id_token) {
        const ticket = await client.verifyIdToken({
          idToken: tokens.id_token,
          audience: this.clientId,
        });

        const payload = ticket.getPayload();
        if (!payload?.email) {
          throw new Error('Invalid token payload');
        }

        return {
          tokens,
          userInfo: {
            id: payload.sub,
            email: payload.email,
            name: payload.name || payload.email,
            picture: payload.picture,
            verified_email: payload.email_verified || false,
          },
        };
      }

      if (!tokens.access_token) {
        throw new Error('Google did not return an access token or id_token');
      }

      const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (!userinfoRes.ok) {
        throw new Error(`Google userinfo failed: ${userinfoRes.status}`);
      }
      const profile = (await userinfoRes.json()) as {
        id: string;
        email: string;
        name?: string;
        picture?: string;
        verified_email?: boolean;
      };

      return {
        tokens,
        userInfo: {
          id: profile.id,
          email: profile.email,
          name: profile.name || profile.email,
          picture: profile.picture,
          verified_email: profile.verified_email || false,
        },
      };
    } catch (error) {
      logger.error('Google OAuth error:', error);
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to authenticate with Google: ${detail}`);
    }
  }

  /**
   * Verify Google ID token
   */
  async verifyIdToken(idToken: string): Promise<GoogleUserInfo> {
    try {
      const client = this.createClient(this.defaultRedirectUri);
      const ticket = await client.verifyIdToken({
        idToken,
        audience: this.clientId,
      });

      const payload = ticket.getPayload();
      if (!payload) {
        throw new Error('Invalid token payload');
      }

      return {
        id: payload.sub,
        email: payload.email!,
        name: payload.name!,
        picture: payload.picture,
        verified_email: payload.email_verified || false,
      };
    } catch (error) {
      logger.error('Google token verification error:', error);
      throw new Error('Invalid Google token');
    }
  }
}

export const googleAuthService = new GoogleAuthService();
