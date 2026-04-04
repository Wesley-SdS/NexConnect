import { Injectable } from '@nestjs/common';
import { IBroadcastStrategy } from './broadcast-strategy.interface';

@Injectable()
export class RandomStrategy implements IBroadcastStrategy {
  async selectInstance(pool: string[]): Promise<string> {
    return pool[Math.floor(Math.random() * pool.length)];
  }
}
