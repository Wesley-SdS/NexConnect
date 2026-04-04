import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { WorkerModule } from './worker.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    bufferLogs: true,
  });

  app.useLogger(app.get(Logger));

  const logger = app.get(Logger);

  app.enableShutdownHooks();

  logger.log('Worker started successfully', 'Bootstrap');

  process.on('SIGTERM', async () => {
    logger.log('Received SIGTERM, gracefully shutting down...', 'Bootstrap');
    await app.close();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    logger.log('Received SIGINT, gracefully shutting down...', 'Bootstrap');
    await app.close();
    process.exit(0);
  });
}

bootstrap();
