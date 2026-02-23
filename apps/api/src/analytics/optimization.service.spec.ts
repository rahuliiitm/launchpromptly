import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { OptimizationService } from './optimization.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectService } from '../project/project.service';

const mockAnalysisResponse = {
  content: [
    {
      type: 'text' as const,
      text: 'Consider removing redundant instructions and combining similar directives.',
    },
  ],
};

jest.mock('@anthropic-ai/sdk', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      messages: {
        create: jest.fn().mockResolvedValue(mockAnalysisResponse),
      },
    })),
  };
});

describe('OptimizationService', () => {
  let service: OptimizationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OptimizationService,
        {
          provide: PrismaService,
          useValue: {
            lLMEvent: {
              groupBy: jest.fn().mockResolvedValue([]),
            },
            promptTemplate: {
              findUnique: jest.fn().mockResolvedValue({
                projectId: 'proj-1',
                systemHash: 'hash-abc',
                normalizedContent: 'You are a helpful assistant that answers questions.',
              }),
            },
          },
        },
        {
          provide: ProjectService,
          useValue: {
            assertProjectAccess: jest.fn().mockResolvedValue(undefined),
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

    service = module.get<OptimizationService>(OptimizationService);
  });

  it('should return model_downgrade recommendation for expensive models', async () => {
    const prisma = service['prisma'];
    (prisma.lLMEvent.groupBy as jest.Mock)
      .mockResolvedValueOnce([
        { model: 'gpt-4o', _sum: { costUsd: 50 }, _count: { id: 500 } },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await service.getRecommendations('proj-1', 'user-1');
    const downgrade = result.find((r) => r.type === 'model_downgrade');
    expect(downgrade).toBeDefined();
    expect(downgrade?.currentModel).toBe('gpt-4o');
    expect(downgrade?.suggestedModel).toBe('gpt-4o-mini');
    expect(downgrade?.estimatedSavingsUsd).toBeGreaterThan(0);
  });

  it('should skip downgrade for cheap models', async () => {
    const prisma = service['prisma'];
    (prisma.lLMEvent.groupBy as jest.Mock)
      .mockResolvedValueOnce([
        { model: 'gpt-4o-mini', _sum: { costUsd: 5 }, _count: { id: 1000 } },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await service.getRecommendations('proj-1', 'user-1');
    expect(result.find((r) => r.type === 'model_downgrade')).toBeUndefined();
  });

  it('should return verbose_prompt recommendation for high input token templates', async () => {
    const prisma = service['prisma'];
    (prisma.lLMEvent.groupBy as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          systemHash: 'hash-verbose',
          _avg: { inputTokens: 6000 },
          _sum: { costUsd: 20 },
          _count: { id: 200 },
        },
      ])
      .mockResolvedValueOnce([]);

    const result = await service.getRecommendations('proj-1', 'user-1');
    const verbose = result.find((r) => r.type === 'verbose_prompt');
    expect(verbose).toBeDefined();
    expect(verbose?.estimatedSavingsUsd).toBeCloseTo(6, 1);
  });

  it('should return caching_opportunity for high-frequency templates', async () => {
    const prisma = service['prisma'];
    (prisma.lLMEvent.groupBy as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          systemHash: 'hash-repeat',
          _count: { id: 500 },
          _sum: { costUsd: 30 },
        },
      ]);

    const result = await service.getRecommendations('proj-1', 'user-1');
    const caching = result.find((r) => r.type === 'caching_opportunity');
    expect(caching).toBeDefined();
    expect(caching?.estimatedSavingsUsd).toBeCloseTo(15, 1);
  });

  it('should sort recommendations by savings descending', async () => {
    const prisma = service['prisma'];
    (prisma.lLMEvent.groupBy as jest.Mock)
      .mockResolvedValueOnce([
        { model: 'gpt-4o', _sum: { costUsd: 10 }, _count: { id: 100 } },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { systemHash: 'hash-x', _count: { id: 500 }, _sum: { costUsd: 100 } },
      ]);

    const result = await service.getRecommendations('proj-1', 'user-1');
    for (let i = 1; i < result.length; i++) {
      const prev = result[i - 1];
      const curr = result[i];
      if (prev && curr) {
        expect(prev.estimatedSavingsUsd).toBeGreaterThanOrEqual(curr.estimatedSavingsUsd);
      }
    }
  });

  it('should analyze template with Claude and return analysis text', async () => {
    const result = await service.analyzeTemplateWithClaude('proj-1', 'user-1', 'hash-abc');
    expect(result).toContain('removing redundant');
  });

  it('should return fallback when ANTHROPIC_API_KEY is not set', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OptimizationService,
        {
          provide: PrismaService,
          useValue: {
            lLMEvent: { groupBy: jest.fn() },
            promptTemplate: {
              findUnique: jest.fn().mockResolvedValue({
                projectId: 'proj-1',
                systemHash: 'hash-abc',
                normalizedContent: 'Test content',
              }),
            },
          },
        },
        {
          provide: ProjectService,
          useValue: { assertProjectAccess: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(undefined) },
        },
      ],
    }).compile();

    const svc = module.get<OptimizationService>(OptimizationService);
    const result = await svc.analyzeTemplateWithClaude('proj-1', 'user-1', 'hash-abc');
    expect(result).toContain('unavailable');
  });
});
