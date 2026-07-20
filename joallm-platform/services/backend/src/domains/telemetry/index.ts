import { FastifyInstance } from 'fastify';
import { registerDomainEventDispatcher } from '../../utils/domain-events.js';
import { logger, logRequest } from '../../utils/logger.js';
import { metricsRoutes } from '../../routes/metrics.js';

const requestStartTimeKey = Symbol('requestStartTime');

export async function registerTelemetryDomain(fastify: FastifyInstance) {
  await fastify.register(metricsRoutes, { prefix: '/api/telemetry' });

  registerDomainEventDispatcher((event) => {
    logger.info('Domain event emitted', {
      eventType: event.type,
      source: event.source,
      occurredAt: event.occurredAt,
      metadata: event.metadata,
      payload: event.payload
    });
  });

  fastify.addHook('onRequest', async (request) => {
    (request as any)[requestStartTimeKey] = Date.now();
  });

  fastify.addHook('onResponse', async (request, reply) => {
    const startTime = (request as any)[requestStartTimeKey] as number | undefined;
    const duration = startTime ? Date.now() - startTime : 0;
    logRequest(request, reply, duration);
  });
}
