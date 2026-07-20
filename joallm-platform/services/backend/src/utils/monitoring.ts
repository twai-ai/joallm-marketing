import { logger } from './logger.js';

// Simple in-memory metrics store (replace with Redis/StatsD in production)
interface Metrics {
  requests: number;
  errors: number;
  responseTime: number[];
  activeConnections: number;
  dbConnections: number;
}

const metrics: Metrics = {
  requests: 0,
  errors: 0,
  responseTime: [],
  activeConnections: 0,
  dbConnections: 0,
};

// Track request
export function trackRequest(responseTime: number) {
  metrics.requests++;
  metrics.responseTime.push(responseTime);
  
  // Keep only last 1000 response times
  if (metrics.responseTime.length > 1000) {
    metrics.responseTime.shift();
  }
  
  // Log slow requests
  if (responseTime > 1000) {
    logger.warn(`Slow request detected: ${responseTime}ms`);
  }
}

// Track error
export function trackError(errorType: string) {
  metrics.errors++;
  logger.error(`Error tracked: ${errorType}`);
}

// Track active connections
export function trackConnection(delta: number) {
  metrics.activeConnections += delta;
  logger.debug(`Active connections: ${metrics.activeConnections}`);
}

// Track database connections
export function trackDbConnection(delta: number) {
  metrics.dbConnections += delta;
}

// Get metrics
export function getMetrics() {
  const avgResponseTime = metrics.responseTime.length > 0
    ? metrics.responseTime.reduce((a, b) => a + b, 0) / metrics.responseTime.length
    : 0;

  return {
    ...metrics,
    avgResponseTime: Math.round(avgResponseTime),
    minResponseTime: Math.min(...metrics.responseTime),
    maxResponseTime: Math.max(...metrics.responseTime),
    errorRate: metrics.requests > 0 ? (metrics.errors / metrics.requests) * 100 : 0,
    p50: calculatePercentile(50),
    p95: calculatePercentile(95),
    p99: calculatePercentile(99),
  };
}

// Calculate percentile
function calculatePercentile(percentile: number): number {
  if (metrics.responseTime.length === 0) return 0;
  
  const sorted = [...metrics.responseTime].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[index] || 0;
}

// Reset metrics (call periodically if needed)
export function resetMetrics() {
  metrics.requests = 0;
  metrics.errors = 0;
  metrics.responseTime = [];
}

// Health check data
interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  checks: {
    database: boolean;
    redis?: boolean;
    memory: boolean;
  };
}

export function getHealthCheck(): HealthCheck {
  const uptime = process.uptime();
  const memUsage = process.memoryUsage();
  
  // Check memory usage
  const memoryUsageMB = memUsage.heapUsed / 1024 / 1024;
  const memoryLimitMB = (memUsage.heapTotal / 1024 / 1024) * 2;
  const memoryHealthy = memoryUsageMB < memoryLimitMB * 0.9;
  
  // Determine overall status
  const errorRate = metrics.requests > 0 ? (metrics.errors / metrics.requests) * 100 : 0;
  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  if (!memoryHealthy || errorRate > 10) {
    status = 'unhealthy';
  } else if (errorRate > 5) {
    status = 'degraded';
  }
  
  return {
    status,
    timestamp: new Date().toISOString(),
    uptime,
    version: process.env.npm_package_version || '1.0.0',
    checks: {
      database: true, // TODO: implement actual DB check
      memory: memoryHealthy,
    },
  };
}

// Performance monitoring decorator
export function measurePerformance(operation: string) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const method = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const start = Date.now();
      try {
        const result = await method.apply(this, args);
        const duration = Date.now() - start;
        trackRequest(duration);
        logger.debug(`${operation} completed in ${duration}ms`);
        return result;
      } catch (error) {
        trackError(operation);
        throw error;
      }
    };
    
    return descriptor;
  };
}
