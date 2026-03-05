import { LoggerService, LogLevel } from '@nestjs/common';
import { getRequestId } from './request-context';

/**
 * Structured JSON logger compatible with GCP Cloud Logging.
 *
 * In production: emits single-line JSON with `severity`, `message`,
 * `requestId`, `context`, and optional `stack` / `data` fields.
 * GCP Cloud Logging automatically parses JSON from stdout.
 *
 * In development: falls back to human-readable plain text.
 */
export class StructuredLogger implements LoggerService {
  private readonly isProduction = process.env['NODE_ENV'] === 'production';

  log(message: string, context?: string): void {
    this.emit('INFO', message, context);
  }

  error(message: string, stackOrContext?: string, context?: string): void {
    // NestJS sometimes calls error(message, stack, context) or error(message, context)
    const isStack = stackOrContext?.includes('\n') || stackOrContext?.startsWith('Error');
    this.emit(
      'ERROR',
      message,
      isStack ? context : stackOrContext,
      isStack ? stackOrContext : undefined,
    );
  }

  warn(message: string, context?: string): void {
    this.emit('WARNING', message, context);
  }

  debug(message: string, context?: string): void {
    if (this.isProduction) return; // skip debug in prod
    this.emit('DEBUG', message, context);
  }

  verbose(message: string, context?: string): void {
    if (this.isProduction) return;
    this.emit('DEBUG', message, context);
  }

  fatal(message: string, context?: string): void {
    this.emit('CRITICAL', message, context);
  }

  setLogLevels?(_levels: LogLevel[]): void {
    // no-op — level filtering is handled by GCP Cloud Logging
  }

  private emit(
    severity: string,
    message: string,
    context?: string,
    stack?: string,
  ): void {
    const requestId = getRequestId();

    if (!this.isProduction) {
      // Human-readable for local dev
      const prefix = context ? `[${context}]` : '';
      const rid = requestId !== 'no-request' ? ` [${requestId}]` : '';
      const line = `${severity.padEnd(7)} ${prefix} ${message}${rid}`;
      if (severity === 'ERROR' || severity === 'CRITICAL') {
        process.stderr.write(line + '\n');
        if (stack) process.stderr.write(stack + '\n');
      } else {
        process.stdout.write(line + '\n');
      }
      return;
    }

    // Structured JSON for GCP Cloud Logging
    const entry: Record<string, unknown> = {
      severity,
      message,
      requestId,
      ...(context && { context }),
      ...(stack && { stack }),
      timestamp: new Date().toISOString(),
    };

    const line = JSON.stringify(entry);
    if (severity === 'ERROR' || severity === 'CRITICAL') {
      process.stderr.write(line + '\n');
    } else {
      process.stdout.write(line + '\n');
    }
  }
}
