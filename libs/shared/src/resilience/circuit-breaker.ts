export interface CircuitBreakerOptions {
  /** Number of consecutive failures before opening the circuit. Default: 5 */
  failureThreshold: number;
  /** Time in ms to wait before transitioning from OPEN to HALF_OPEN. Default: 30000 */
  resetTimeoutMs: number;
  /** Max attempts allowed in HALF_OPEN state before fully closing or reopening. Default: 3 */
  halfOpenMaxAttempts: number;
  /** Identifier for logging and metrics */
  name: string;
}

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

const DEFAULT_OPTIONS: Omit<CircuitBreakerOptions, 'name'> = {
  failureThreshold: 5,
  resetTimeoutMs: 30_000,
  halfOpenMaxAttempts: 3,
};

export class CircuitBreakerOpenError extends Error {
  constructor(name: string) {
    super(`Circuit breaker "${name}" is OPEN — requests are being rejected`);
    this.name = 'CircuitBreakerOpenError';
  }
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private halfOpenAttempts = 0;
  private lastFailureTime = 0;
  private readonly options: CircuitBreakerOptions;

  constructor(options: Partial<CircuitBreakerOptions> & Pick<CircuitBreakerOptions, 'name'>) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Execute a function through the circuit breaker.
   * Throws `CircuitBreakerOpenError` if the circuit is OPEN and the reset timeout has not elapsed.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (this.shouldTransitionToHalfOpen()) {
        this.transitionTo(CircuitState.HALF_OPEN);
      } else {
        throw new CircuitBreakerOpenError(this.options.name);
      }
    }

    if (this.state === CircuitState.HALF_OPEN && this.halfOpenAttempts >= this.options.halfOpenMaxAttempts) {
      this.transitionTo(CircuitState.OPEN);
      throw new CircuitBreakerOpenError(this.options.name);
    }

    try {
      if (this.state === CircuitState.HALF_OPEN) {
        this.halfOpenAttempts++;
      }

      const result = await fn();

      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /** Returns the current state of the circuit breaker. */
  getState(): CircuitState {
    return this.state;
  }

  /** Manually reset the circuit breaker to CLOSED state. */
  reset(): void {
    this.transitionTo(CircuitState.CLOSED);
  }

  private onSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.transitionTo(CircuitState.CLOSED);
    }
    this.failureCount = 0;
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      this.transitionTo(CircuitState.OPEN);
      return;
    }

    if (this.failureCount >= this.options.failureThreshold) {
      this.transitionTo(CircuitState.OPEN);
    }
  }

  private shouldTransitionToHalfOpen(): boolean {
    return Date.now() - this.lastFailureTime >= this.options.resetTimeoutMs;
  }

  private transitionTo(newState: CircuitState): void {
    this.state = newState;

    if (newState === CircuitState.CLOSED) {
      this.failureCount = 0;
      this.halfOpenAttempts = 0;
    }

    if (newState === CircuitState.HALF_OPEN) {
      this.halfOpenAttempts = 0;
    }
  }
}
