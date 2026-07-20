import { FastifyInstance } from 'fastify';
import { userSettingsRoutes } from '../../routes/user-settings.js';

export async function registerUserSettingsDomain(fastify: FastifyInstance) {
  await fastify.register(userSettingsRoutes, {
    prefix: '/api/users/settings'
  });
}
