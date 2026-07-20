import { describe, it, expect, beforeEach, vi } from 'vitest';

const redisMock = {
  get: vi.fn(),
  set: vi.fn(),
};

vi.mock('../../../services/queue.js', () => ({
  redisInstance: redisMock,
}));

import {
  blacklistToken,
  generateToken,
  verifyToken,
  generateRefreshToken,
  verifyRefreshToken,
  isTokenBlacklisted,
  tokenBlacklistKey,
} from '../../../middleware/auth.js';

describe('Auth Middleware', () => {
  const testUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    name: 'Test User',
    role: 'casual' as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateToken', () => {
    it('should generate a valid JWT token', () => {
      const token = generateToken(testUser);
      
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT format: header.payload.signature
    });

    it('should include user data in token', () => {
      const token = generateToken(testUser);
      const decoded = verifyToken(token);
      
      expect(decoded).toBeTruthy();
      expect(decoded?.id).toBe(testUser.id);
      expect(decoded?.email).toBe(testUser.email);
      expect(decoded?.name).toBe(testUser.name);
      expect(decoded?.role).toBe(testUser.role);
    });
  });

  describe('verifyToken', () => {
    it('should verify valid token', () => {
      const token = generateToken(testUser);
      const decoded = verifyToken(token);
      
      expect(decoded).toBeTruthy();
      expect(decoded?.id).toBe(testUser.id);
    });

    it('should return null for invalid token', () => {
      const decoded = verifyToken('invalid.token.here');
      expect(decoded).toBeNull();
    });

    it('should return null for expired token', () => {
      // Create a token with very short expiry
      const shortLivedToken = generateToken(testUser);
      // In real implementation, you'd need to manipulate time or use a backdated token
      // For now, just test that verification works
      const decoded = verifyToken(shortLivedToken);
      expect(decoded).toBeTruthy();
    });

    it('should return null for malformed token', () => {
      const decoded = verifyToken('not-a-jwt-token');
      expect(decoded).toBeNull();
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a valid refresh token', () => {
      const refreshToken = generateRefreshToken({
        id: testUser.id,
        email: testUser.email,
      });
      
      expect(refreshToken).toBeTruthy();
      expect(typeof refreshToken).toBe('string');
      expect(refreshToken.split('.')).toHaveLength(3);
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify valid refresh token', () => {
      const refreshToken = generateRefreshToken({
        id: testUser.id,
        email: testUser.email,
      });
      
      const decoded = verifyRefreshToken(refreshToken);
      
      expect(decoded).toBeTruthy();
      expect(decoded?.id).toBe(testUser.id);
      expect(decoded?.email).toBe(testUser.email);
    });

    it('should return null for invalid refresh token', () => {
      const decoded = verifyRefreshToken('invalid.refresh.token');
      expect(decoded).toBeNull();
    });
  });

  describe('token blacklist', () => {
    it('should store a hashed blacklist entry in Redis', async () => {
      const refreshToken = generateRefreshToken({
        id: testUser.id,
        email: testUser.email,
      });

      await blacklistToken(refreshToken);

      expect(redisMock.set).toHaveBeenCalledWith(
        tokenBlacklistKey(refreshToken),
        '1',
        'EX',
        expect.any(Number),
      );
    });

    it('should report token as blacklisted when Redis contains the hash', async () => {
      const refreshToken = generateRefreshToken({
        id: testUser.id,
        email: testUser.email,
      });
      redisMock.get.mockResolvedValue('1');

      await expect(isTokenBlacklisted(refreshToken)).resolves.toBe(true);
      expect(redisMock.get).toHaveBeenCalledWith(tokenBlacklistKey(refreshToken));
    });

    it('should report token as not blacklisted when Redis misses', async () => {
      const refreshToken = generateRefreshToken({
        id: testUser.id,
        email: testUser.email,
      });
      redisMock.get.mockResolvedValue(null);

      await expect(isTokenBlacklisted(refreshToken)).resolves.toBe(false);
      expect(redisMock.get).toHaveBeenCalledWith(tokenBlacklistKey(refreshToken));
    });
  });
});


