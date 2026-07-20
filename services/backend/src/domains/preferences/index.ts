import { FastifyInstance } from 'fastify';
import { preferencesRoutes } from '../../routes/preferences.js';

export async function registerPreferencesDomain(fastify: FastifyInstance) {
  await fastify.register(preferencesRoutes, {
    prefix: '/api/preferences'
  });
}

