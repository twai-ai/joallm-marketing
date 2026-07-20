export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export interface CircuitBreakerOptions {
  failureThreshold: number;
  timeout: number;
  resetTimeout: number;
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime?: Date;
  nextAttemptTime?: Date;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private successes: number = 0;
  private lastFailureTime?: Date;
  private nextAttemptTime?: Date;
  private options: CircuitBreakerOptions;

  constructor(options: Partial<CircuitBreakerOptions> = {}) {
    this.options = {
      failureThreshold: options.failureThreshold || 5,
      timeout: options.timeout || 60000,
      resetTimeout: options.resetTimeout || 30000,
    };
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitState.HALF_OPEN;
        console.log('Circuit breaker transitioning to HALF_OPEN state');
      } else {
        throw new Error('Circuit breaker is OPEN - service unavailable');
      }
    }

    try {
      const result = await Promise.race([
        operation(),
        this.createTimeoutPromise()
      ]);

      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private createTimeoutPromise<T>(): Promise<T> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Circuit breaker timeout'));
      }, this.options.timeout);
    });
  }

  private onSuccess(): void {
    this.failures = 0;
    this.successes++;
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.CLOSED;
      console.log('Circuit breaker transitioning to CLOSED state');
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = new Date();
    this.successes = 0;

    if (this.failures >= this.options.failureThreshold) {
      this.state = CircuitState.OPEN;
      this.nextAttemptTime = new Date(Date.now() + this.options.resetTimeout);
      console.warn(`Circuit breaker transitioning to OPEN state after ${this.failures} failures`);
    }
  }

  private shouldAttemptReset(): boolean {
    if (!this.nextAttemptTime) {
      return true;
    }
    return Date.now() >= this.nextAttemptTime.getTime();
  }

  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      nextAttemptTime: this.nextAttemptTime,
    };
  }

  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = undefined;
    this.nextAttemptTime = undefined;
    console.log('Circuit breaker manually reset');
  }
}

export class CircuitBreakerManager {
  private breakers: Map<string, CircuitBreaker> = new Map();

  getBreaker(serviceName: string): CircuitBreaker {
    if (!this.breakers.has(serviceName)) {
      this.breakers.set(serviceName, new CircuitBreaker());
    }
    return this.breakers.get(serviceName)!;
  }

  async executeWithBreaker<T>(
    serviceName: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const breaker = this.getBreaker(serviceName);
    return breaker.execute(operation);
  }

  getStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};
    for (const [serviceName, breaker] of this.breakers) {
      stats[serviceName] = breaker.getStats();
    }
    return stats;
  }

  reset(serviceName?: string): void {
    if (serviceName) {
      const breaker = this.breakers.get(serviceName);
      if (breaker) {
        breaker.reset();
      }
    } else {
      for (const breaker of this.breakers.values()) {
        breaker.reset();
      }
    }
  }
}

export const circuitBreakerManager = new CircuitBreakerManager();

