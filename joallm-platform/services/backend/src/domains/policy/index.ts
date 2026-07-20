import { FastifyInstance } from 'fastify';
import { policyRoutes } from './routes.js';

export async function registerPolicyDomain(fastify: FastifyInstance) {
  await fastify.register(policyRoutes, { prefix: '/api/policy' });
}
