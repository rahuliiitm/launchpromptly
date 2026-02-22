import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdvisoryService } from './advisory.service';
import { PrismaService } from '../prisma/prisma.service';

const mockScenario = {
  id: 'scenario-123',
  userId: 'user-123',
  name: 'Test Scenario',
  model: 'gpt-4',
  avgInputTokens: 1000,
  avgOutputTokens: 500,
  requestsPerUser: 100,
  projectedUsers: 1000,
  subscriptionPrice: 29,
  createdAt: new Date('2025-01-01'),
};

const mockAnthropicResponse = {
  content: [
    {
      type: 'text' as const,
      text: 'Your current margin of 91.4% is excellent. The most impactful change would be scaling users.',
    },
  ],
};

jest.mock('@anthropic-ai/sdk', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      messages: {
        create: jest.fn().mockResolvedValue(mockAnthropicResponse),
      },
    })),
  };
});

describe('AdvisoryService', () => {
  let service: AdvisoryService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdvisoryService,
        {
          provide: PrismaService,
          useValue: {
            scenario: {
              findUnique: jest.fn().mockResolvedValue(mockScenario),
            },
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              if (key === 'ANTHROPIC_API_KEY') return 'test-api-key';
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AdvisoryService>(AdvisoryService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('generateInsight', () => {
    it('should return insight text from Anthropic response', async () => {
      const result = await service.generateInsight('scenario-123');

      expect(result.insight).toContain('91.4%');
      expect(result.generatedAt).toBeInstanceOf(Date);
    });

    it('should throw NotFoundException for missing scenario', async () => {
      (prisma.scenario.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.generateInsight('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should call Anthropic with claude-3-5-haiku-latest model', async () => {
      const Anthropic = jest.requireMock('@anthropic-ai/sdk').default;
      const mockInstance = Anthropic.mock.results[Anthropic.mock.results.length - 1]?.value;

      await service.generateInsight('scenario-123');

      expect(mockInstance.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-3-5-haiku-latest',
          max_tokens: 1024,
        }),
      );
    });

    it('should include scenario financials in the prompt', async () => {
      const Anthropic = jest.requireMock('@anthropic-ai/sdk').default;
      const mockInstance = Anthropic.mock.results[Anthropic.mock.results.length - 1]?.value;

      await service.generateInsight('scenario-123');

      const callArgs = mockInstance.messages.create.mock.calls[0][0];
      const userMessage = callArgs.messages[0].content;

      expect(userMessage).toContain('Test Scenario');
      expect(userMessage).toContain('gpt-4');
      expect(userMessage).toContain('$29/month');
    });

    it('should include architecture comparisons in the prompt', async () => {
      const Anthropic = jest.requireMock('@anthropic-ai/sdk').default;
      const mockInstance = Anthropic.mock.results[Anthropic.mock.results.length - 1]?.value;

      await service.generateInsight('scenario-123');

      const callArgs = mockInstance.messages.create.mock.calls[0][0];
      const userMessage = callArgs.messages[0].content;

      expect(userMessage).toContain('Full GPT-4');
      expect(userMessage).toContain('GPT-4 Mini');
      expect(userMessage).toContain('Hybrid');
      expect(userMessage).toContain('RAG-style');
    });
  });

  describe('generateInsight without API key', () => {
    it('should throw when ANTHROPIC_API_KEY is not set', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AdvisoryService,
          {
            provide: PrismaService,
            useValue: {
              scenario: {
                findUnique: jest.fn().mockResolvedValue(mockScenario),
              },
            },
          },
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn().mockReturnValue(undefined),
            },
          },
        ],
      }).compile();

      const serviceNoKey = module.get<AdvisoryService>(AdvisoryService);

      await expect(serviceNoKey.generateInsight('scenario-123')).rejects.toThrow(
        'AI advisory is not configured',
      );
    });
  });
});
