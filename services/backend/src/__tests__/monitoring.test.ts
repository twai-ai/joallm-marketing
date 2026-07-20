import { describe, it, expect, beforeEach } from 'vitest';
import {
  trackRequest,
  trackError,
  getMetrics,
  resetMetrics,
  getHealthCheck,
} from '../utils/monitoring';

describe('Monitoring', () => {
  beforeEach(() => {
    resetMetrics();
  });

  describe('Request Tracking', () => {
    it('should track requests and calculate metrics', () => {
      trackRequest(100);
      trackRequest(200);
      trackRequest(300);

      const metrics = getMetrics();
      expect(metrics.requests).toBe(3);
      expect(metrics.avgResponseTime).toBe(200);
      expect(metrics.minResponseTime).toBe(100);
      expect(metrics.maxResponseTime).toBe(300);
    });

    it('should calculate percentiles correctly', () => {
      // Add 100 requests with varying response times
      for (let i = 1; i <= 100; i++) {
        trackRequest(i * 10);
      }

      const metrics = getMetrics();
      expect(metrics.p50).toBe(500); // 50th percentile
      expect(metrics.p95).toBe(950); // 95th percentile
      expect(metrics.p99).toBe(990); // 99th percentile
    });

    it('should limit response time array to 1000 entries', () => {
      for (let i = 0; i < 1500; i++) {
        trackRequest(100);
      }

      const metrics = getMetrics();
      expect(metrics.responseTime.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('Error Tracking', () => {
    it('should track errors and calculate error rate', () => {
      trackRequest(100);
      trackRequest(200);
      trackError('ValidationError');
      trackError('DatabaseError');

      const metrics = getMetrics();
      expect(metrics.errors).toBe(2);
      expect(metrics.errorRate).toBe(100); // 2 errors / 2 requests
    });

    it('should handle zero requests without errors', () => {
      const metrics = getMetrics();
      expect(metrics.errorRate).toBe(0);
    });
  });

  describe('Health Check', () => {
    it('should return health check data', () => {
      const health = getHealthCheck();
      
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('timestamp');
      expect(health).toHaveProperty('uptime');
      expect(health).toHaveProperty('version');
      expect(health).toHaveProperty('checks');
      
      expect(['healthy', 'degraded', 'unhealthy']).toContain(health.status);
    });

    it('should include memory checks', () => {
      const health = getHealthCheck();
      expect(health.checks).toHaveProperty('memory');
      expect(typeof health.checks.memory).toBe('boolean');
    });
  });

  describe('Metrics Reset', () => {
    it('should reset all metrics', () => {
      trackRequest(100);
      trackError('TestError');
      
      resetMetrics();
      
      const metrics = getMetrics();
      expect(metrics.requests).toBe(0);
      expect(metrics.errors).toBe(0);
      expect(metrics.responseTime.length).toBe(0);
    });
  });
});
