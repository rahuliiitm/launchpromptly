import './instrument'; // Sentry must be imported before anything else
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';
import { StructuredLogger } from './common/structured-logger';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: new StructuredLogger(),
  });
  const logger = new Logger('Bootstrap');

  // --- CORS ---
  const corsOrigin = process.env['CORS_ORIGIN'];
  const isProduction = process.env['NODE_ENV'] === 'production';

  if (isProduction && !corsOrigin) {
    logger.warn(
      'CORS_ORIGIN not set in production — defaulting to block all cross-origin requests. ' +
        'Set CORS_ORIGIN to a comma-separated list of allowed origins.',
    );
  }

  app.enableCors({
    origin: corsOrigin
      ? corsOrigin.split(',').map((o) => o.trim())
      : isProduction
        ? false // block all cross-origin in prod if not configured
        : ['http://localhost:3000', 'http://localhost:3002'],
    credentials: true,
  });

  // --- Body size limits ---
  app.useBodyParser('json', { limit: '1mb' });
  app.useBodyParser('urlencoded', { limit: '1mb', extended: true });

  // --- Global pipes / filters ---
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  // --- Request logging ---
  app.use(new RequestLoggerMiddleware().use.bind(new RequestLoggerMiddleware()));

  const port = process.env['API_PORT'] ?? 3001;
  await app.listen(port);
  logger.log(`Server running on port ${port}`);
}

void bootstrap();
