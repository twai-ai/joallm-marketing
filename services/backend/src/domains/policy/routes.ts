import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import { evaluatePolicy } from '../../services/policy-service.js';
import { emitDomainEvent } from '../../utils/domain-events.js';

const PolicyEvaluationSchema = z.object({
  policyId: z.string().min(1),
  subject: z.string().min(1),
  action: z.string().min(1),
  resource: z.string().optional(),
  context: z.record(z.unknown()).optional()
});

export async function policyRoutes(fastify: FastifyInstance, _options: FastifyPluginOptions) {
  fastify.post('/evaluate', {
    schema: {
      description: 'Evaluate a policy decision for a given subject/action pair',
      tags: ['policy'],
      body: {
        type: 'object',
        properties: {
          policyId: { type: 'string' },
          subject: { type: 'string' },
          action: { type: 'string' },
          resource: { type: 'string' },
          context: { type: 'object', additionalProperties: true }
        },
        required: ['policyId', 'subject', 'action']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            decision: { type: 'string', enum: ['allow', 'deny'] },
            explanation: { type: 'string' },
            metadata: { type: 'object', additionalProperties: true }
          }
        }
      }
    }
  }, async (request, reply) => {
    const payload = PolicyEvaluationSchema.parse(request.body);

    const result = await evaluatePolicy(payload);

    await emitDomainEvent('policy.decision.evaluated', {
      policyId: payload.policyId,
      subject: payload.subject,
      action: payload.action,
      resource: payload.resource,
      result: result.result,
      explanation: result.explanation
    }, 'services/backend/policy');

    return reply.send({
      decision: result.result,
      explanation: result.explanation,
      metadata: result.metadata
    });
  });
}
