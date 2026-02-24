import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PlaygroundService } from './playground.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProviderKeyService } from '../provider-key/provider-key.service';
import { LlmGatewayService } from './llm-gateway.service';

describe('PlaygroundService', () => {
  let service: PlaygroundService;
  let prisma: jest.Mocked<PrismaService>;
  let providerKeyService: jest.Mocked<ProviderKeyService>;
  let llmGateway: jest.Mocked<LlmGatewayService>;

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn() },
    } as unknown as jest.Mocked<PrismaService>;

    providerKeyService = {
      getDecryptedKey: jest.fn(),
      listKeys: jest.fn(),
    } as unknown as jest.Mocked<ProviderKeyService>;

    llmGateway = {
      callModel: jest.fn(),
    } as unknown as jest.Mocked<LlmGatewayService>;

    service = new PlaygroundService(prisma, providerKeyService, llmGateway);
  });

  describe('testPrompt', () => {
    it('rejects more than 3 models', async () => {
      await expect(
        service.testPrompt('u1', 'sys', 'msg', ['a', 'b', 'c', 'd']),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects empty model list', async () => {
      await expect(
        service.testPrompt('u1', 'sys', 'msg', []),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects unknown models', async () => {
      await expect(
        service.testPrompt('u1', 'sys', 'msg', ['nonexistent-model']),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects user without organization', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'u1', organizationId: null });
      await expect(
        service.testPrompt('u1', 'sys', 'msg', ['gpt-4o']),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects if provider key not configured', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'u1', organizationId: 'org1' });
      (providerKeyService.getDecryptedKey as jest.Mock).mockResolvedValue(null);

      await expect(
        service.testPrompt('u1', 'sys', 'msg', ['gpt-4o']),
      ).rejects.toThrow(BadRequestException);
    });

    it('calls gateway for each model in parallel', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'u1', organizationId: 'org1' });
      (providerKeyService.getDecryptedKey as jest.Mock).mockResolvedValue('sk-test');
      (llmGateway.callModel as jest.Mock).mockResolvedValue({
        model: 'gpt-4o',
        provider: 'openai',
        response: 'Hello!',
        inputTokens: 10,
        outputTokens: 5,
        totalTokens: 15,
        costUsd: 0.001,
        latencyMs: 500,
      });

      const result = await service.testPrompt('u1', 'sys', 'msg', ['gpt-4o']);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].response).toBe('Hello!');
      expect(llmGateway.callModel).toHaveBeenCalledWith('openai', 'sk-test', 'gpt-4o', 'sys', 'msg');
    });
  });

  describe('getAvailableModels', () => {
    it('returns empty array for user without org', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'u1', organizationId: null });
      const result = await service.getAvailableModels('u1');
      expect(result).toEqual([]);
    });

    it('returns models matching configured providers', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'u1', organizationId: 'org1' });
      (providerKeyService.listKeys as jest.Mock).mockResolvedValue([
        { id: 'k1', provider: 'openai', label: 'Default', createdAt: new Date() },
      ]);

      const result = await service.getAvailableModels('u1');
      expect(result.length).toBeGreaterThan(0);
      expect(result.every((m: string) => m.startsWith('gpt') || m.startsWith('o'))).toBe(true);
      expect(result.some((m: string) => m.startsWith('claude'))).toBe(false);
    });
  });
});
