import { FastifyInstance } from 'fastify';
import { healthRoutes } from '../../routes/health.js';

export async function registerHealthDomain(fastify: FastifyInstance) {
  await fastify.register(healthRoutes, { prefix: '/api/health' });
}
