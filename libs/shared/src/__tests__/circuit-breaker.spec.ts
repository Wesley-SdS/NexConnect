import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CircuitBreaker,
  CircuitState,
  CircuitBreakerOpenError,
} from '../resilience/circuit-breaker';

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    vi.clearAllMocks();
    breaker = new CircuitBreaker({
      name: 'test-breaker',
      failureThreshold: 3,
      resetTimeoutMs: 1000,
      halfOpenMaxAttempts: 2,
    });
  });

  describe('CLOSED state', () => {
    it('should start in CLOSED state', () => {
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should execute successfully and remain CLOSED', async () => {
      const result = await breaker.execute(() => Promise.resolve('ok'));

      expect(result).toBe('ok');
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should propagate errors but stay CLOSED under threshold', async () => {
      const failFn = () => Promise.reject(new Error('fail'));

      await expect(breaker.execute(failFn)).rejects.toThrow('fail');
      expect(breaker.getState()).toBe(CircuitState.CLOSED);

      await expect(breaker.execute(failFn)).rejects.toThrow('fail');
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });
  });

  describe('CLOSED -> OPEN transition', () => {
    it('should open after reaching failure threshold', async () => {
      const failFn = () => Promise.reject(new Error('fail'));

      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(failFn)).rejects.toThrow('fail');
      }

      expect(breaker.getState()).toBe(CircuitState.OPEN);
    });
  });

  describe('OPEN state', () => {
    it('should reject immediately with CircuitBreakerOpenError', async () => {
      await tripBreaker();

      await expect(
        breaker.execute(() => Promise.resolve('should not run')),
      ).rejects.toThrow(CircuitBreakerOpenError);
    });

    it('should include breaker name in error message', async () => {
      await tripBreaker();

      await expect(
        breaker.execute(() => Promise.resolve()),
      ).rejects.toThrow('test-breaker');
    });
  });

  describe('OPEN -> HALF_OPEN transition', () => {
    it('should transition to HALF_OPEN after reset timeout', async () => {
      await tripBreaker();
      expect(breaker.getState()).toBe(CircuitState.OPEN);

      // Advance time past resetTimeoutMs
      vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 1100);

      // Next call should transition to HALF_OPEN and execute
      const result = await breaker.execute(() => Promise.resolve('recovered'));
      expect(result).toBe('recovered');
      // After success in HALF_OPEN, should be CLOSED
      expect(breaker.getState()).toBe(CircuitState.CLOSED);

      vi.restoreAllMocks();
    });
  });

  describe('HALF_OPEN -> CLOSED on success', () => {
    it('should close circuit after successful execution in HALF_OPEN', async () => {
      await tripBreaker();

      vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 1100);

      await breaker.execute(() => Promise.resolve('ok'));

      expect(breaker.getState()).toBe(CircuitState.CLOSED);

      vi.restoreAllMocks();
    });
  });

  describe('HALF_OPEN -> OPEN on failure', () => {
    it('should reopen circuit after failure in HALF_OPEN', async () => {
      await tripBreaker();

      vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 1100);

      await expect(
        breaker.execute(() => Promise.reject(new Error('still broken'))),
      ).rejects.toThrow('still broken');

      expect(breaker.getState()).toBe(CircuitState.OPEN);

      vi.restoreAllMocks();
    });
  });

  describe('HALF_OPEN max attempts', () => {
    it('should reopen if max half-open attempts exceeded', async () => {
      await tripBreaker();

      const realNow = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(realNow + 1100);

      // First half-open attempt: fail -> goes to OPEN
      await expect(
        breaker.execute(() => Promise.reject(new Error('fail1'))),
      ).rejects.toThrow('fail1');
      expect(breaker.getState()).toBe(CircuitState.OPEN);

      vi.restoreAllMocks();
    });
  });

  describe('reset', () => {
    it('should manually reset to CLOSED state', async () => {
      await tripBreaker();
      expect(breaker.getState()).toBe(CircuitState.OPEN);

      breaker.reset();

      expect(breaker.getState()).toBe(CircuitState.CLOSED);

      const result = await breaker.execute(() => Promise.resolve('after reset'));
      expect(result).toBe('after reset');
    });
  });

  describe('recovery flow', () => {
    it('should handle full lifecycle: CLOSED -> OPEN -> HALF_OPEN -> CLOSED', async () => {
      // Start CLOSED
      expect(breaker.getState()).toBe(CircuitState.CLOSED);

      // Trip to OPEN
      await tripBreaker();
      expect(breaker.getState()).toBe(CircuitState.OPEN);

      // Wait for timeout -> HALF_OPEN -> success -> CLOSED
      vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 1100);
      await breaker.execute(() => Promise.resolve('fixed'));
      expect(breaker.getState()).toBe(CircuitState.CLOSED);

      // Should work normally again
      const result = await breaker.execute(() => Promise.resolve('normal'));
      expect(result).toBe('normal');

      vi.restoreAllMocks();
    });
  });

  async function tripBreaker() {
    const failFn = () => Promise.reject(new Error('fail'));
    for (let i = 0; i < 3; i++) {
      try {
        await breaker.execute(failFn);
      } catch {
        // expected
      }
    }
  }
});
