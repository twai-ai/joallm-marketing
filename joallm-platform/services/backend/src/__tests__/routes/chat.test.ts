import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { chatRoutes } from '../../routes/chat';

describe('Chat Routes', () => {
  let server: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    server = Fastify({ logger: false });
    await server.register(chatRoutes);
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  describe('POST /send', () => {
    it('should validate request body', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/send',
        payload: {}, // Invalid payload
      });

      expect(response.statusCode).toBe(400);
    });

    it('should require messages array', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/send',
        payload: {
          model: 'gpt-4',
        },
      });

      expect(response.statusCode).toBeGreaterThanOrEqual(400);
    });
  });

  describe('GET /sessions', () => {
    it.skip('should return sessions with pagination', async () => {
      // Skipped: Requires test database with proper credentials
      // To enable: Set up test database with matching credentials in test environment
      const response = await server.inject({
        method: 'GET',
        url: '/sessions?page=1&limit=10',
      });

      // The route should return a response (may be empty without auth)
      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data).toHaveProperty('sessions');
    });
  });
});
