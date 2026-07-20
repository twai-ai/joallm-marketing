import { FastifyInstance } from 'fastify';
import { acquisitionRoutes, metaWebhookRoutes } from '../../routes/acquisition.js';

export async function registerAcquisitionDomain(fastify: FastifyInstance) {
  // Studio + acquisition APIs on the Railway backend service
  await fastify.register(acquisitionRoutes, {
    prefix: '/api/acquisition',
  });

  // Native Meta callback hosted on the same backend container
  await fastify.register(metaWebhookRoutes, {
    prefix: '/api/meta',
  });
}
