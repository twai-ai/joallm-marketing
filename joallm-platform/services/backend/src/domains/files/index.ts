import { FastifyInstance } from 'fastify';
import { filesRoutes } from '../../routes/files.js';
import { authenticateToken } from '../../middleware/auth.js';

export async function registerFilesDomain(fastify: FastifyInstance) {
  await fastify.register(filesRoutes, {
    prefix: '/api/files',
    preHandler: authenticateToken
  });
}
