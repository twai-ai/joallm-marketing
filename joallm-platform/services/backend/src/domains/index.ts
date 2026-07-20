import { FastifyInstance } from 'fastify';
import { registerAuthDomain } from './auth/index.js';
import { registerChatDomain } from './chat/index.js';
import { registerFilesDomain } from './files/index.js';
import { registerHealthDomain } from './health/index.js';
import { registerModelsDomain } from './models/index.js';
import { registerRagDomain } from './rag/index.js';
import { registerSurveyDomain } from './survey/index.js';
import { registerUserSettingsDomain } from './user-settings/index.js';
import { registerPolicyDomain } from './policy/index.js';
import { registerTelemetryDomain } from './telemetry/index.js';
import { registerWorkflowDomain } from './workflow/index.js';
import { registerBookmarksDomain } from './bookmarks/index.js';
import { registerPreferencesDomain } from './preferences/index.js';
import { registerSecurityDomain } from './security/index.js';
import { registerNotebooksDomain } from './notebooks/index.js';
import { adminRoutes } from '../routes/admin.js';
import { subscriptionRoutes } from '../routes/subscriptions.js';
import { meRoutes } from '../routes/me.js';
import { feedbackRoutes } from '../routes/feedback.js';
import { integrationsRoutes } from '../routes/integrations.js';

export async function registerDomains(fastify: FastifyInstance) {
  await registerTelemetryDomain(fastify);
  await registerHealthDomain(fastify);
  await registerAuthDomain(fastify);
  await registerModelsDomain(fastify);
  await registerChatDomain(fastify);
  await registerFilesDomain(fastify);
  await registerRagDomain(fastify);
  await registerUserSettingsDomain(fastify);
  await registerSurveyDomain(fastify);
  await registerPolicyDomain(fastify);
  await registerWorkflowDomain(fastify);
  await registerBookmarksDomain(fastify);
  await registerPreferencesDomain(fastify);
  await registerSecurityDomain(fastify);
  await registerNotebooksDomain(fastify);
  
  // Admin routes (database maintenance, etc.)
  fastify.register(adminRoutes, { prefix: '/api/admin' });

  // Subscription management
  fastify.register(subscriptionRoutes, { prefix: '/api/subscriptions' });

  // Me / access bootstrap
  fastify.register(meRoutes, { prefix: '/api/me' });

  // Feedback, training signals & consent
  fastify.register(feedbackRoutes, { prefix: '/api/feedback' });

  // Third-party integrations (Google Workspace OAuth, etc.)
  fastify.register(integrationsRoutes, { prefix: '/api/integrations' });
}
