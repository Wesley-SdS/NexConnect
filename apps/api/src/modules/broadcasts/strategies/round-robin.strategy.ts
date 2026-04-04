import { Injectable } from '@nestjs/common';
import { IBroadcastStrategy } from './broadcast-strategy.interface';

@Injectable()
export class RoundRobinStrategy implements IBroadcastStrategy {
  async selectInstance(pool: string[], index: number): Promise<string> {
    return pool[index % pool.length];
  }
}
