import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { ApiKeyGuard } from './api-key.guard';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('bcrypt');

describe('ApiKeyGuard', () => {
  let guard: ApiKeyGuard;
  let prisma: PrismaService;

  const mockApiKey = {
    id: 'key-1',
    keyPrefix: 'lp_live_abc1234',
    keyHash: '$2b$10$realhash',
    projectId: 'proj-1',
    environmentId: 'env-1',
    revokedAt: null,
    expiresAt: null,
    lastUsedAt: null,
  };

  function createMockContext(authHeader?: string): ExecutionContext {
    const req = { headers: { authorization: authHeader } };
    return {
      switchToHttp: () => ({
        getRequest: () => req,
      }),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    prisma = {
      apiKey: {
        findFirst: jest.fn().mockResolvedValue(mockApiKey),
        update: jest.fn().mockResolvedValue(mockApiKey),
      },
    } as unknown as PrismaService;

    guard = new ApiKeyGuard(prisma);
  });

  it('should reject missing authorization header', async () => {
    const ctx = createMockContext(undefined);
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('should reject non-lp_live_ prefixed keys', async () => {
    const ctx = createMockContext('Bearer sk-1234567890');
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    expect(bcrypt.compare).not.toHaveBeenCalled();
  });

  it('should run bcrypt even when key prefix not found (constant-time)', async () => {
    (prisma.apiKey.findFirst as jest.Mock).mockResolvedValue(null);
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    const ctx = createMockContext('Bearer lp_live_abc12345678901234567890');
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    expect(bcrypt.compare).toHaveBeenCalledTimes(1);
  });

  it('should reject expired API key', async () => {
    (prisma.apiKey.findFirst as jest.Mock).mockResolvedValue({
      ...mockApiKey,
      expiresAt: new Date('2020-01-01'),
    });

    const ctx = createMockContext('Bearer lp_live_abc12345678901234567890');
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('should reject valid prefix with wrong key', async () => {
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    const ctx = createMockContext('Bearer lp_live_abc12345678901234567890');
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('should allow valid API key and set projectId on request', async () => {
    const ctx = createMockContext('Bearer lp_live_abc12345678901234567890');
    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(bcrypt.compare).toHaveBeenCalledTimes(1);

    const req = ctx.switchToHttp().getRequest() as Record<string, unknown>;
    expect(req.projectId).toBe('proj-1');
  });
});
