import { FastifyInstance } from 'fastify';
import { chatRoutes } from '../../routes/chat.js';
import { authenticateToken } from '../../middleware/auth.js';

export async function registerChatDomain(fastify: FastifyInstance) {
  await fastify.register(chatRoutes, {
    prefix: '/api/chat',
    preHandler: authenticateToken
  });
}
