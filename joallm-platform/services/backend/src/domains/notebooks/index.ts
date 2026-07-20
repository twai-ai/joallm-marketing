import { FastifyInstance } from 'fastify';
import { notebooksRoutes } from '../../routes/notebooks.js';

export async function registerNotebooksDomain(fastify: FastifyInstance) {
  await fastify.register(notebooksRoutes, {
    prefix: '/api/notebooks'
  });
}

