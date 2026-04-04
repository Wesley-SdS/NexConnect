import { Injectable, Logger } from '@nestjs/common';

interface ReconnectionState {
  attempts: number;
  maxAttempts: number;
  circuitOpen: boolean;
  circuitOpenedAt: number | null;
  circuitCooldownMs: number;
  timer: ReturnType<typeof setTimeout> | null;
}

@Injectable()
export class ReconnectionService {
  private readonly logger = new Logger(ReconnectionService.name);
  private readonly states = new Map<string, ReconnectionState>();

  private static readonly BASE_DELAY_MS = 1000;
  private static readonly MAX_DELAY_MS = 60000;
  private static readonly MAX_ATTEMPTS = 10;
  private static readonly CIRCUIT_COOLDOWN_MS = 300000; // 5 minutes

  async scheduleReconnection(
    instanceId: string,
    reconnectFn: () => Promise<void>,
  ): Promise<void> {
    const state = this.getOrCreateState(instanceId);

    if (this.isCircuitOpen(state)) {
      this.logger.warn('Circuit breaker open, skipping reconnection', {
        instanceId,
        cooldownRemainingMs: this.getRemainingCooldown(state),
      });
      return;
    }

    if (state.attempts >= state.maxAttempts) {
      this.openCircuit(instanceId, state);
      return;
    }

    const delay = this.calculateDelay(state.attempts);
    state.attempts++;

    this.logger.log('Scheduling reconnection', {
      instanceId,
      attempt: state.attempts,
      delayMs: delay,
    });

    state.timer = setTimeout(async () => {
      try {
        await reconnectFn();
      } catch (error) {
        this.logger.error('Reconnection attempt failed', {
          instanceId,
          attempt: state.attempts,
          error: (error as Error).message,
        });

        await this.scheduleReconnection(instanceId, reconnectFn);
      }
    }, delay);
  }

  cancelReconnection(instanceId: string): void {
    const state = this.states.get(instanceId);
    if (state?.timer) {
      clearTimeout(state.timer);
      state.timer = null;
    }
    this.states.delete(instanceId);

    this.logger.debug('Reconnection cancelled', { instanceId });
  }

  resetAttempts(instanceId: string): void {
    const state = this.states.get(instanceId);
    if (state) {
      state.attempts = 0;
      state.circuitOpen = false;
      state.circuitOpenedAt = null;
    }
  }

  isInstanceCircuitOpen(instanceId: string): boolean {
    const state = this.states.get(instanceId);
    return state ? this.isCircuitOpen(state) : false;
  }

  private getOrCreateState(instanceId: string): ReconnectionState {
    let state = this.states.get(instanceId);
    if (!state) {
      state = {
        attempts: 0,
        maxAttempts: ReconnectionService.MAX_ATTEMPTS,
        circuitOpen: false,
        circuitOpenedAt: null,
        circuitCooldownMs: ReconnectionService.CIRCUIT_COOLDOWN_MS,
        timer: null,
      };
      this.states.set(instanceId, state);
    }
    return state;
  }

  private calculateDelay(attempt: number): number {
    const exponentialDelay =
      ReconnectionService.BASE_DELAY_MS * Math.pow(2, attempt);
    const cappedDelay = Math.min(
      exponentialDelay,
      ReconnectionService.MAX_DELAY_MS,
    );
    const jitter = Math.random() * cappedDelay * 0.3;

    return Math.floor(cappedDelay + jitter);
  }

  private isCircuitOpen(state: ReconnectionState): boolean {
    if (!state.circuitOpen) {
      return false;
    }

    if (state.circuitOpenedAt) {
      const elapsed = Date.now() - state.circuitOpenedAt;
      if (elapsed >= state.circuitCooldownMs) {
        state.circuitOpen = false;
        state.circuitOpenedAt = null;
        state.attempts = 0;
        return false;
      }
    }

    return true;
  }

  private getRemainingCooldown(state: ReconnectionState): number {
    if (!state.circuitOpenedAt) {
      return 0;
    }
    return Math.max(
      0,
      state.circuitCooldownMs - (Date.now() - state.circuitOpenedAt),
    );
  }

  private openCircuit(
    instanceId: string,
    state: ReconnectionState,
  ): void {
    state.circuitOpen = true;
    state.circuitOpenedAt = Date.now();

    this.logger.error('Circuit breaker opened after max attempts', {
      instanceId,
      attempts: state.attempts,
      cooldownMs: state.circuitCooldownMs,
    });
  }
}
