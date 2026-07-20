import { FastifyInstance } from 'fastify';
import { surveyRoutes } from '../../routes/survey.js';

export async function registerSurveyDomain(fastify: FastifyInstance) {
  await fastify.register(surveyRoutes, { prefix: '/api/survey' });
}
