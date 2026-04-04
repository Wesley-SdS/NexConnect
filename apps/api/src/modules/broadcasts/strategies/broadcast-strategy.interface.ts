export interface IBroadcastStrategy {
  selectInstance(pool: string[], index: number): Promise<string>;
}

export const BROADCAST_STRATEGY = Symbol('BROADCAST_STRATEGY');
