import { FastifyInstance } from 'fastify';
import { authRoutes } from '../../routes/auth.js';

export async function registerAuthDomain(fastify: FastifyInstance) {
  await fastify.register(authRoutes, { prefix: '/api/auth' });
}
