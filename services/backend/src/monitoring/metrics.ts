/**
 * Metrics Collection System
 * 
 * Tracks request metrics, errors, and API usage for monitoring and analytics
 */

import { logger } from '../utils/logger.js';

interface RequestMetric {
  endpoint: string;
  method: string;
  statusCode: number;
  duration: number;
  timestamp: Date;
  userId?: string;
}

interface ErrorMetric {
  error: Error;
  context: any;
  timestamp: Date;
  endpoint?: string;
  userId?: string;
}

interface APIUsageMetric {
  userId: string;
  cost: number;
  tokens: number;
  model: string;
  timestamp: Date;
}

export class MetricsCollector {
  private requestMetrics: RequestMetric[] = [];
  private errorMetrics: ErrorMetric[] = [];
  private apiUsageMetrics: APIUsageMetric[] = [];
  
  private maxMetricsSize = 10000; // Keep last 10k metrics in memory
  private metricsFlushInterval = 60000; // Flush metrics every minute

  constructor() {
    // Set up periodic metrics reporting
    setInterval(() => this.reportMetrics(), this.metricsFlushInterval);
  }

  /**
   * Track an HTTP request
   */
  trackRequest(
    endpoint: string,
    method: string,
    statusCode: number,
    duration: number,
    userId?: string
  ): void {
    const metric: RequestMetric = {
      endpoint,
      method,
      statusCode,
      duration,
      timestamp: new Date(),
      userId,
    };

    this.requestMetrics.push(metric);
    
    // Trim if exceeds max size
    if (this.requestMetrics.length > this.maxMetricsSize) {
      this.requestMetrics.shift();
    }

    // Log slow requests (>5 seconds)
    if (duration > 5000) {
      logger.warn(`Slow request detected: ${method} ${endpoint} took ${duration}ms`);
    }

    // Log failed requests
    if (statusCode >= 500) {
      logger.error(`Server error on ${method} ${endpoint}: ${statusCode}`);
    }
  }

  /**
   * Track an error
   */
  trackError(error: Error, context: any = {}, endpoint?: string, userId?: string): void {
    const metric: ErrorMetric = {
      error,
      context,
      timestamp: new Date(),
      endpoint,
      userId,
    };

    this.errorMetrics.push(metric);
    
    // Trim if exceeds max size
    if (this.errorMetrics.length > this.maxMetricsSize) {
      this.errorMetrics.shift();
    }

    logger.error('Error tracked:', {
      message: error.message,
      stack: error.stack,
      endpoint,
      userId,
      context,
    });
  }

  /**
   * Track API usage
   */
  trackAPIUsage(userId: string, cost: number, tokens: number, model: string): void {
    const metric: APIUsageMetric = {
      userId,
      cost,
      tokens,
      model,
      timestamp: new Date(),
    };

    this.apiUsageMetrics.push(metric);
    
    // Trim if exceeds max size
    if (this.apiUsageMetrics.length > this.maxMetricsSize) {
      this.apiUsageMetrics.shift();
    }

    logger.debug(`API usage tracked: ${tokens} tokens, ${cost} cents, model: ${model}`);
  }

  /**
   * Get metrics summary
   */
  getMetricsSummary(): {
    requests: {
      total: number;
      byStatus: Record<number, number>;
      averageDuration: number;
      slowRequests: number;
    };
    errors: {
      total: number;
      recent: number; // Last hour
    };
    apiUsage: {
      totalCost: number;
      totalTokens: number;
      uniqueUsers: number;
    };
  } {
    const now = Date.now();
    const oneHourAgo = now - 3600000;

    // Request metrics
    const totalRequests = this.requestMetrics.length;
    const byStatus = this.requestMetrics.reduce((acc, m) => {
      acc[m.statusCode] = (acc[m.statusCode] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);
    
    const averageDuration = totalRequests > 0
      ? this.requestMetrics.reduce((sum, m) => sum + m.duration, 0) / totalRequests
      : 0;
    
    const slowRequests = this.requestMetrics.filter(m => m.duration > 5000).length;

    // Error metrics
    const totalErrors = this.errorMetrics.length;
    const recentErrors = this.errorMetrics.filter(
      m => m.timestamp.getTime() > oneHourAgo
    ).length;

    // API usage metrics
    const totalCost = this.apiUsageMetrics.reduce((sum, m) => sum + m.cost, 0);
    const totalTokens = this.apiUsageMetrics.reduce((sum, m) => sum + m.tokens, 0);
    const uniqueUsers = new Set(this.apiUsageMetrics.map(m => m.userId)).size;

    return {
      requests: {
        total: totalRequests,
        byStatus,
        averageDuration,
        slowRequests,
      },
      errors: {
        total: totalErrors,
        recent: recentErrors,
      },
      apiUsage: {
        totalCost,
        totalTokens,
        uniqueUsers,
      },
    };
  }

  /**
   * Report metrics (called periodically)
   */
  private reportMetrics(): void {
    const summary = this.getMetricsSummary();
    
    logger.info('📊 Metrics Report:', {
      requests: {
        total: summary.requests.total,
        avgDuration: `${summary.requests.averageDuration.toFixed(2)}ms`,
        slowRequests: summary.requests.slowRequests,
        '2xx': summary.requests.byStatus[200] || 0,
        '4xx': Object.entries(summary.requests.byStatus)
          .filter(([code]) => code.startsWith('4'))
          .reduce((sum, [, count]) => sum + count, 0),
        '5xx': Object.entries(summary.requests.byStatus)
          .filter(([code]) => code.startsWith('5'))
          .reduce((sum, [, count]) => sum + count, 0),
      },
      errors: {
        total: summary.errors.total,
        lastHour: summary.errors.recent,
      },
      apiUsage: {
        cost: `${(summary.apiUsage.totalCost / 100).toFixed(2)} USD`,
        tokens: summary.apiUsage.totalTokens.toLocaleString(),
        users: summary.apiUsage.uniqueUsers,
      },
    });
  }

  /**
   * Clear all metrics (useful for testing)
   */
  clearMetrics(): void {
    this.requestMetrics = [];
    this.errorMetrics = [];
    this.apiUsageMetrics = [];
    logger.info('All metrics cleared');
  }
}

// Singleton instance
export const metricsCollector = new MetricsCollector();

