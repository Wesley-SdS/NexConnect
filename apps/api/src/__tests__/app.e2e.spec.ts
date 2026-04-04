import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import request from 'supertest';
import { AppModule } from '../app.module';

describe('NexConnect API (E2E)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    app.setGlobalPrefix('v1');
    await app.init();
    await (app as NestFastifyApplication)
      .getHttpAdapter()
      .getInstance()
      .ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /v1/health', () => {
    it('should return health status', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/health')
        .expect(200);

      expect(response.body).toHaveProperty('status');
    });
  });

  describe('GET /v1/health/live', () => {
    it('should return alive', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/health/live')
        .expect(200);

      expect(response.body.status).toBe('alive');
    });
  });

  describe('GET /v1/health/ready', () => {
    it('should return ready when services are up', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/health/ready')
        .expect(200);

      expect(response.body.status).toBe('ready');
      expect(response.body.checks).toEqual({
        database: 'ok',
        redis: 'ok',
      });
    });
  });

  describe('Authentication', () => {
    it('should reject request without API key', async () => {
      await request(app.getHttpServer()).get('/v1/instances').expect(401);
    });

    it('should reject invalid API key', async () => {
      await request(app.getHttpServer())
        .get('/v1/instances')
        .set('Authorization', 'Bearer nc_invalid_key')
        .expect(401);
    });
  });

  describe('Correlation ID', () => {
    it('should return x-correlation-id header', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/health')
        .expect(200);

      expect(response.headers['x-correlation-id']).toBeDefined();
    });

    it('should echo provided x-correlation-id', async () => {
      const correlationId = 'test-correlation-id-123';

      const response = await request(app.getHttpServer())
        .get('/v1/health')
        .set('x-correlation-id', correlationId)
        .expect(200);

      expect(response.headers['x-correlation-id']).toBe(correlationId);
    });
  });
});
