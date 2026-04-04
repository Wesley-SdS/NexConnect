import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;
  private subscriber: Redis;

  async onModuleInit(): Promise<void> {
    this.client = this.createConnection('main');
    this.subscriber = this.createConnection('subscriber');

    this.client.on('error', (err) =>
      this.logger.error(`Redis client error: ${err.message}`),
    );
    this.subscriber.on('error', (err) =>
      this.logger.error(`Redis subscriber error: ${err.message}`),
    );

    this.logger.log('Redis connections established');
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.quit();
    await this.subscriber?.quit();
    this.logger.log('Redis connections closed');
  }

  private createConnection(name: string): Redis {
    return new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      connectionName: `nexconnect-${name}`,
      retryStrategy: (times) => Math.min(times * 200, 5000),
      maxRetriesPerRequest: 3,
    });
  }

  getClient(): Redis {
    return this.client;
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(...keys: string[]): Promise<number> {
    return this.client.del(...keys);
  }

  async exists(...keys: string[]): Promise<number> {
    return this.client.exists(...keys);
  }

  async expire(key: string, seconds: number): Promise<number> {
    return this.client.expire(key, seconds);
  }

  async publish(channel: string, message: string): Promise<number> {
    return this.client.publish(channel, message);
  }

  async subscribe(
    channel: string,
    handler: (message: string, channel: string) => void,
  ): Promise<void> {
    await this.subscriber.subscribe(channel);
    this.subscriber.on('message', (ch, msg) => {
      if (ch === channel) {
        handler(msg, ch);
      }
    });
  }

  async hset(
    key: string,
    field: string,
    value: string,
  ): Promise<number> {
    return this.client.hset(key, field, value);
  }

  async hget(key: string, field: string): Promise<string | null> {
    return this.client.hget(key, field);
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    return this.client.hgetall(key);
  }

  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }
}
