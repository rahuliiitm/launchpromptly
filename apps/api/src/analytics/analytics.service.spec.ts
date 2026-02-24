import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectService } from '../project/project.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let projectService: ProjectService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        {
          provide: PrismaService,
          useValue: {
            lLMEvent: {
              aggregate: jest.fn().mockResolvedValue({
                _sum: { costUsd: 12.5 },
                _count: { id: 100 },
                _avg: { latencyMs: 250.7 },
              }),
              groupBy: jest.fn().mockResolvedValue([
                {
                  model: 'gpt-4o',
                  customerId: 'cust-1',
                  feature: 'chat',
                  systemHash: 'hash-abc',
                  _sum: { costUsd: 10 },
                  _count: { id: 80 },
                  _avg: { latencyMs: 200 },
                },
                {
                  model: 'gpt-4o-mini',
                  customerId: 'cust-2',
                  feature: 'search',
                  systemHash: 'hash-def',
                  _sum: { costUsd: 2.5 },
                  _count: { id: 20 },
                  _avg: { latencyMs: 150 },
                },
              ]),
            },
            $queryRaw: jest.fn().mockResolvedValue([
              { date: new Date('2026-02-20'), total_cost: 5.0, call_count: BigInt(50) },
              { date: new Date('2026-02-21'), total_cost: 7.5, call_count: BigInt(50) },
            ]),
          },
        },
        {
          provide: ProjectService,
          useValue: {
            assertProjectAccess: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
    projectService = module.get<ProjectService>(ProjectService);
  });

  it('should return overview with aggregated stats and model breakdown', async () => {
    const result = await service.getOverview('proj-1', 'user-1');
    expect(result.totalCostUsd).toBe(12.5);
    expect(result.totalCalls).toBe(100);
    expect(result.avgLatencyMs).toBe(251);
    expect(result.periodDays).toBe(30);
    expect(result.modelBreakdown).toHaveLength(2);
    expect(result.modelBreakdown[0]?.model).toBe('gpt-4o');
  });

  it('should return customer breakdown sorted by cost', async () => {
    const result = await service.getCustomerBreakdown('proj-1', 'user-1');
    expect(result).toHaveLength(2);
    expect(result[0]?.customerId).toBe('cust-1');
    expect(result[0]?.avgCostPerCall).toBeCloseTo(10 / 80);
  });

  it('should return feature breakdown', async () => {
    const result = await service.getFeatureBreakdown('proj-1', 'user-1');
    expect(result).toHaveLength(2);
    expect(result[0]?.feature).toBe('chat');
  });

  it('should return timeseries with date strings', async () => {
    const result = await service.getTimeSeries('proj-1', 'user-1');
    expect(result).toHaveLength(2);
    expect(result[0]?.date).toBe('2026-02-20');
    expect(result[0]?.costUsd).toBe(5.0);
    expect(result[0]?.callCount).toBe(50);
  });

  it('should throw ForbiddenException for unauthorized user', async () => {
    (projectService.assertProjectAccess as jest.Mock).mockRejectedValue(
      new ForbiddenException(),
    );
    await expect(service.getOverview('proj-1', 'bad-user')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('should default to 30-day window', async () => {
    const result = await service.getOverview('proj-1', 'user-1');
    expect(result.periodDays).toBe(30);
  });
});
