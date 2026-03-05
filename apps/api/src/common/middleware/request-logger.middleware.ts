import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { requestContext } from '../request-context';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const requestId = (req.headers['x-request-id'] as string) || randomUUID();
    const start = Date.now();

    // Attach request ID to response header
    res.setHeader('x-request-id', requestId);

    // Skip logging for health checks (reduces noise)
    const isHealth = req.originalUrl === '/health';

    // Run downstream handlers inside AsyncLocalStorage context
    requestContext.run({ requestId, method: req.method, url: req.originalUrl }, () => {
      res.on('finish', () => {
        if (isHealth) return;

        const duration = Date.now() - start;
        const { method, originalUrl } = req;
        const { statusCode } = res;

        const message = `${method} ${originalUrl} ${statusCode} ${duration}ms`;

        if (statusCode >= 500) {
          this.logger.error(message);
        } else if (statusCode >= 400) {
          this.logger.warn(message);
        } else {
          this.logger.log(message);
        }
      });

      next();
    });
  }
}
