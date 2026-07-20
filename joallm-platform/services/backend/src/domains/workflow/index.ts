import { FastifyInstance } from 'fastify';
import { workflowRoutes } from '../../routes/workflows.js';

export async function registerWorkflowDomain(fastify: FastifyInstance) {
  await fastify.register(workflowRoutes, {
    prefix: '/api/workflows'
  });
}

