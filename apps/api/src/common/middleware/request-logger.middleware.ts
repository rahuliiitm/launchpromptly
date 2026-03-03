import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Request, Response, NextFunction } from 'express';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const requestId = randomUUID();
    const start = Date.now();

    // Attach request ID to headers so downstream handlers can access it
    req.headers['x-request-id'] = requestId;
    res.setHeader('x-request-id', requestId);

    res.on('finish', () => {
      const duration = Date.now() - start;
      const { method, originalUrl } = req;
      const { statusCode } = res;

      const message = `${method} ${originalUrl} ${statusCode} ${duration}ms [${requestId}]`;

      if (statusCode >= 500) {
        this.logger.error(message);
      } else if (statusCode >= 400) {
        this.logger.warn(message);
      } else {
        this.logger.log(message);
      }
    });

    next();
  }
}
