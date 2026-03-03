import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import type { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const rawMessage =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    const message = typeof rawMessage === 'string'
      ? rawMessage
      : (rawMessage as Record<string, unknown>)['message'] ?? rawMessage;

    this.logger.error(
      `HTTP ${status} error`,
      exception instanceof Error ? exception.stack : undefined,
    );

    // Report 5xx errors to Sentry
    if (status >= 500) {
      Sentry.captureException(exception);
    }

    // Add helpful hints for common error codes
    let hint: string | undefined;
    if (status === 401) {
      hint = 'Check your Authorization header. JWT tokens: "Bearer <jwt>". API keys: "Bearer lp_live_<key>".';
    } else if (status === 403) {
      hint = 'You do not have permission for this action. Check your role (admin vs member) in Settings → Team.';
    } else if (status === HttpStatus.INTERNAL_SERVER_ERROR && !(exception instanceof HttpException)) {
      hint = 'An unexpected error occurred. Check the server logs for details. If this persists, please report it.';
    }

    response.status(status).json({
      statusCode: status,
      message,
      ...(hint && { hint }),
      timestamp: new Date().toISOString(),
    });
  }
}
