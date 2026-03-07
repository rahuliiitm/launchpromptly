import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

// Pre-computed bcrypt hash used for constant-time rejection when no API key
// matches the supplied prefix — prevents timing-based prefix enumeration.
const DUMMY_HASH = '$2b$10$K4G0IFSZ.m7chQ1LphMU0OriseDnOY32qi.X7HFXE5pJtHv5Fjqy6';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers['authorization'];

    if (!authHeader?.startsWith('Bearer lp_live_')) {
      throw new UnauthorizedException(
        'Valid API key required. Send header: Authorization: Bearer lp_live_<your-key>. ' +
        'Generate one in Settings → API Keys.',
      );
    }

    const rawKey = authHeader.slice(7);
    const prefix = rawKey.slice(0, 16);

    const apiKey = await this.prisma.apiKey.findFirst({
      where: { keyPrefix: prefix, revokedAt: null },
    });

    if (!apiKey) {
      await bcrypt.compare(rawKey, DUMMY_HASH);
      throw new UnauthorizedException(
        'Invalid or revoked API key. Check that you are using a valid key from Settings → API Keys.',
      );
    }

    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      throw new UnauthorizedException(
        'API key has expired. Generate a new key in Settings → API Keys.',
      );
    }

    const isValid = await bcrypt.compare(rawKey, apiKey.keyHash);
    if (!isValid) {
      throw new UnauthorizedException(
        'Invalid API key. The key format is correct but authentication failed. ' +
        'Regenerate a new key in Settings → API Keys.',
      );
    }

    (request as Request & { projectId: string; environmentId?: string }).projectId = apiKey.projectId;
    if (apiKey.environmentId) {
      (request as Request & { environmentId: string }).environmentId = apiKey.environmentId;
    }

    void this.prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    });

    return true;
  }
}
