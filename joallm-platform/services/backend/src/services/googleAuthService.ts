import { OAuth2Client } from 'google-auth-library';
import { config } from '../config/config.js';
import { logger } from '../utils/logger.js';

export interface GoogleUserInfo {
  id: string;
  email: string;
  name: string;
  picture?: string;
  verified_email: boolean;
}

export class GoogleAuthService {
  private client: OAuth2Client;

  constructor() {
    this.client = new OAuth2Client(
      config.googleClientId,
      config.googleClientSecret,
      config.googleRedirectUri
    );
  }

  /**
   * Generate Google OAuth URL for user to authorize
   */
  generateAuthUrl(): string {
    try {
      const scopes = [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile'
      ];

      const authUrl = this.client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        include_granted_scopes: true
      });

      logger.info('Generated Google OAuth URL', { 
        clientId: config.googleClientId,
        redirectUri: config.googleRedirectUri,
        hasSecret: !!config.googleClientSecret && config.googleClientSecret !== 'PLACEHOLDER-GOOGLE-CLIENT-SECRET'
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
  async getTokenAndUserInfo(code: string): Promise<{
    tokens: any;
    userInfo: GoogleUserInfo;
  }> {
    try {
      // Exchange code for tokens
      const { tokens } = await this.client.getToken(code);
      this.client.setCredentials(tokens);

      // Get user info from Google
      const ticket = await this.client.verifyIdToken({
        idToken: tokens.id_token!,
        audience: config.googleClientId,
      });

      const payload = ticket.getPayload();
      if (!payload) {
        throw new Error('Invalid token payload');
      }

      const userInfo: GoogleUserInfo = {
        id: payload.sub,
        email: payload.email!,
        name: payload.name!,
        picture: payload.picture,
        verified_email: payload.email_verified || false,
      };

      return { tokens, userInfo };
    } catch (error) {
      logger.error('Google OAuth error:', error);
      throw new Error('Failed to authenticate with Google');
    }
  }

  /**
   * Verify Google ID token
   */
  async verifyIdToken(idToken: string): Promise<GoogleUserInfo> {
    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: config.googleClientId,
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
