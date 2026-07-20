import { FastifyInstance } from 'fastify';
import { bookmarksRoutes } from '../../routes/bookmarks.js';

export async function registerBookmarksDomain(fastify: FastifyInstance) {
  await fastify.register(bookmarksRoutes, {
    prefix: '/api/bookmarks'
  });
}

