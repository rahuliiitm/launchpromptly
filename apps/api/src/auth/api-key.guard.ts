import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers['authorization'];

    if (!authHeader?.startsWith('Bearer pf_live_')) {
      throw new UnauthorizedException('API key required');
    }

    const rawKey = authHeader.slice(7);
    const prefix = rawKey.slice(0, 16);

    const apiKey = await this.prisma.apiKey.findFirst({
      where: { keyPrefix: prefix, revokedAt: null },
    });

    if (!apiKey) {
      throw new UnauthorizedException('Invalid API key');
    }

    const isValid = await bcrypt.compare(rawKey, apiKey.keyHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid API key');
    }

    (request as Request & { projectId: string }).projectId = apiKey.projectId;

    void this.prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    });

    return true;
  }
}
