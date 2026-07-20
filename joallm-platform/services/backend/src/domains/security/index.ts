import { FastifyInstance } from 'fastify';
import { securityRoutes } from '../../routes/security.js';

export async function registerSecurityDomain(fastify: FastifyInstance) {
  await fastify.register(securityRoutes, {
    prefix: '/api/security'
  });
}

