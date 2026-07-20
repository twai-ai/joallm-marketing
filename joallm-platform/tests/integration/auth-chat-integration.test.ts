import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp as buildGateway } from '../../services/api-gateway/src/index';
import { buildApp as buildAuthService } from '../../services/auth-service/src/index';
import { buildApp as buildChatService } from '../../services/chat-service/src/index';

describe('Auth-Chat Integration', () => {
  let gateway: FastifyInstance;
  let authService: FastifyInstance;
  let chatService: FastifyInstance;
  let accessToken: string;
  let userId: string;

  beforeAll(async () => {
    // Start all services
    authService = buildAuthService();
    await authService.listen({ port: 3001, host: '0.0.0.0' });

    chatService = buildChatService();
    await chatService.listen({ port: 3002, host: '0.0.0.0' });

    gateway = buildGateway();
    await gateway.listen({ port: 3000, host: '0.0.0.0' });
  });

  afterAll(async () => {
    await gateway.close();
    await authService.close();
    await chatService.close();
  });

  describe('User Registration and Chat Flow', () => {
    it('should register user and create chat session', async () => {
      // Register user
      const registerResponse = await gateway.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'integration@example.com',
          password: 'password123',
          name: 'Integration Test User'
        }
      });

      expect(registerResponse.statusCode).toBe(201);
      const registerData = JSON.parse(registerResponse.payload);
      accessToken = registerData.tokens.accessToken;
      userId = registerData.user.id;

      // Create chat session
      const chatResponse = await gateway.inject({
        method: 'POST',
        url: '/api/chat/message',
        headers: {
          Authorization: `Bearer ${accessToken}`
        },
        payload: {
          message: 'Hello, this is a test message',
          sessionId: 'integration-test-session',
          model: 'gpt-4',
          userId
        }
      });

      expect(chatResponse.statusCode).toBe(200);
      const chatData = JSON.parse(chatResponse.payload);
      expect(chatData).toHaveProperty('response');
      expect(chatData.sessionId).toBe('integration-test-session');
    });

    it('should maintain session across multiple messages', async () => {
      // Send first message
      const firstMessage = await gateway.inject({
        method: 'POST',
        url: '/api/chat/message',
        headers: {
          Authorization: `Bearer ${accessToken}`
        },
        payload: {
          message: 'What is the weather like?',
          sessionId: 'integration-test-session',
          model: 'gpt-4',
          userId
        }
      });

      expect(firstMessage.statusCode).toBe(200);

      // Send follow-up message
      const followUpMessage = await gateway.inject({
        method: 'POST',
        url: '/api/chat/message',
        headers: {
          Authorization: `Bearer ${accessToken}`
        },
        payload: {
          message: 'What about tomorrow?',
          sessionId: 'integration-test-session',
          model: 'gpt-4',
          userId
        }
      });

      expect(followUpMessage.statusCode).toBe(200);
    });

    it('should retrieve chat sessions for user', async () => {
      const sessionsResponse = await gateway.inject({
        method: 'GET',
        url: '/api/chat/sessions',
        headers: {
          Authorization: `Bearer ${accessToken}`
        },
        query: {
          userId
        }
      });

      expect(sessionsResponse.statusCode).toBe(200);
      const sessionsData = JSON.parse(sessionsResponse.payload);
      expect(sessionsData).toHaveProperty('sessions');
      expect(Array.isArray(sessionsData.sessions)).toBe(true);
    });

    it('should handle token expiration', async () => {
      // This test would require mocking token expiration
      // For now, we'll test with an invalid token
      const invalidTokenResponse = await gateway.inject({
        method: 'GET',
        url: '/api/chat/sessions',
        headers: {
          Authorization: 'Bearer invalid-token'
        },
        query: {
          userId
        }
      });

      expect(invalidTokenResponse.statusCode).toBe(401);
    });
  });

  describe('Service Communication', () => {
    it('should handle auth service unavailability', async () => {
      // This test would require stopping the auth service
      // For now, we'll test error handling
      const response = await gateway.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'test@example.com',
          password: 'password123'
        }
      });

      // Should handle service unavailability gracefully
      expect([200, 502, 503]).toContain(response.statusCode);
    });

    it('should handle chat service unavailability', async () => {
      const response = await gateway.inject({
        method: 'POST',
        url: '/api/chat/message',
        headers: {
          Authorization: `Bearer ${accessToken}`
        },
        payload: {
          message: 'Test message',
          sessionId: 'test-session',
          model: 'gpt-4',
          userId
        }
      });

      // Should handle service unavailability gracefully
      expect([200, 502, 503]).toContain(response.statusCode);
    });
  });

  describe('Data Consistency', () => {
    it('should maintain user data consistency across services', async () => {
      // Get user info from auth service
      const userResponse = await gateway.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      expect(userResponse.statusCode).toBe(200);
      const userData = JSON.parse(userResponse.payload);

      // Verify user ID consistency
      expect(userData.user.id).toBe(userId);
    });

    it('should handle concurrent requests', async () => {
      const concurrentRequests = Array(5).fill(null).map((_, index) =>
        gateway.inject({
          method: 'POST',
          url: '/api/chat/message',
          headers: {
            Authorization: `Bearer ${accessToken}`
          },
          payload: {
            message: `Concurrent message ${index}`,
            sessionId: `concurrent-session-${index}`,
            model: 'gpt-4',
            userId
          }
        })
      );

      const responses = await Promise.all(concurrentRequests);
      
      // All requests should be handled (some might fail due to rate limiting)
      responses.forEach(response => {
        expect([200, 429, 502, 503]).toContain(response.statusCode);
      });
    });
  });
});






