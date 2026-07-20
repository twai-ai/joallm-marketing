import { config } from '../config/config.js';
import { logger } from './logger.js';

/**
 * Error tracking service
 * Can be integrated with Sentry, GlitchTip, or other error tracking services
 */

interface ErrorContext {
  userId?: string;
  requestId?: string;
  url?: string;
  method?: string;
  [key: string]: any;
}

class ErrorTrackingService {
  private enabled: boolean;
  private environment: string;

  constructor() {
    this.enabled = config.nodeEnv === 'production';
    this.environment = config.nodeEnv;
  }

  /**
   * Capture an exception
   */
  captureException(error: Error, context?: ErrorContext): void {
    if (!this.enabled) {
      // In development, just log it
      logger.error('Exception captured:', {
        error: error.message,
        stack: error.stack,
        ...context,
      });
      return;
    }

    // In production, send to error tracking service
    // Example: Sentry.captureException(error, { extra: context });
    logger.error('Exception captured for tracking:', {
      error: error.message,
      stack: error.stack,
      environment: this.environment,
      ...context,
    });
  }

  /**
   * Capture a message
   */
  captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info', context?: ErrorContext): void {
    if (!this.enabled) {
      logger[level](message, context);
      return;
    }

    // In production, send to error tracking service
    // Example: Sentry.captureMessage(message, { level, extra: context });
    logger[level === 'warning' ? 'warn' : level](message, context);
  }

  /**
   * Set user context
   */
  setUserContext(userId: string, email?: string, name?: string): void {
    if (!this.enabled) return;

    // Example: Sentry.setUser({ id: userId, email, username: name });
    logger.debug('User context set', { userId, email, name });
  }

  /**
   * Clear user context
   */
  clearUserContext(): void {
    if (!this.enabled) return;

    // Example: Sentry.setUser(null);
    logger.debug('User context cleared');
  }

  /**
   * Add breadcrumb for debugging
   */
  addBreadcrumb(message: string, category: string, data?: Record<string, any>): void {
    if (!this.enabled) return;

    // Example: Sentry.addBreadcrumb({ message, category, data });
    logger.debug('Breadcrumb added', { message, category, data });
  }
}

export const errorTracking = new ErrorTrackingService();



