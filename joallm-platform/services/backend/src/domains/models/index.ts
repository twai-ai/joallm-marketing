import { FastifyInstance } from 'fastify';
import { modelsRoutes } from '../../routes/models.js';

export async function registerModelsDomain(fastify: FastifyInstance) {
  await fastify.register(modelsRoutes, { prefix: '/api/models' });
}
