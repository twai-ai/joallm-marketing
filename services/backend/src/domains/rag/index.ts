import { FastifyInstance } from 'fastify';
import { ragRoutes } from '../../routes/rag.js';
import { ragSuggestionsRoutes } from '../../routes/rag-suggestions.js';
import { authenticateToken } from '../../middleware/auth.js';

export async function registerRagDomain(fastify: FastifyInstance) {
  await fastify.register(ragRoutes, {
    prefix: '/api/rag',
    preHandler: authenticateToken
  });
  
  await fastify.register(ragSuggestionsRoutes, {
    prefix: '/api/rag',
    preHandler: authenticateToken
  });
}
