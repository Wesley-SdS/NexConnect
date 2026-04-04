import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: false,
      bodyLimit: 10 * 1024 * 1024, // 10 MB default
    }),
    { bufferLogs: true },
  );

  app.useLogger(app.get(Logger));

  // Allow 50 MB body for media upload endpoints
  const MEDIA_UPLOAD_BODY_LIMIT = 50 * 1024 * 1024;
  const fastifyInstance = app.getHttpAdapter().getInstance();
  fastifyInstance.addHook('onRoute', (routeOptions: { url?: string; bodyLimit?: number }) => {
    if (routeOptions.url?.includes('/media')) {
      routeOptions.bodyLimit = MEDIA_UPLOAD_BODY_LIMIT;
    }
  });

  app.setGlobalPrefix('v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') ?? '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('NexConnect API')
    .setDescription('WhatsApp Engine API — Pure transport layer for the NexBot ecosystem')
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', description: 'API Key com prefixo nc_' })
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  app.enableShutdownHooks();

  const port = parseInt(process.env.API_PORT ?? '3000', 10);

  await app.listen(port, '0.0.0.0');
}

bootstrap();
