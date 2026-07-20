import { FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../config/config.js';

/**
 * HTTPS redirect middleware
 * Redirects HTTP requests to HTTPS in production
 */
export async function httpsRedirect(
  request: FastifyRequest,
  reply: FastifyReply
) {
  if (config.nodeEnv === 'production') {
    const proto = request.headers['x-forwarded-proto'];
    
    if (proto === 'http') {
      const host = request.headers['host'];
      const url = `https://${host}${request.url}`;
      
      return reply.redirect(301, url);
    }
  }
}

/**
 * Security headers configuration
 */
export const securityHeaders = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Disabled for third-party integrations
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'same-site' },
  originAgentCluster: '?1',
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  strictTransportSecurity: {
    maxAge: 15552000, // 180 days
    includeSubDomains: true,
    preload: true,
  },
  xContentTypeOptions: 'nosniff',
  xDnsPrefetchControl: { allow: false },
  xDownloadOptions: 'noopen',
  xFrameOptions: { action: 'deny' },
  xPermittedCrossDomainPolicies: { permittedPolicies: 'none' },
  xXssProtection: '0', // Disabled in favor of CSP
};



