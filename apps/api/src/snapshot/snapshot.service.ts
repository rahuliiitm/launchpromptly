import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  calculatePerRequestCost,
  calculateCostPerUser,
  calculateMonthlyCost,
  calculateGrossMargin,
  assessRisk,
} from '@aiecon/calculators';
import type { FinancialResult, SnapshotComparison, SnapshotWithFinancials } from '@aiecon/types';
import type { CreateSnapshotDto } from './dto/create-snapshot.dto';

interface SnapshotRecord {
  id: string;
  scenarioId: string;
  label: string;
  model: string;
  avgInputTokens: number;
  avgOutputTokens: number;
  requestsPerUser: number;
  projectedUsers: number;
  subscriptionPrice: number;
  createdAt: Date;
}

@Injectable()
export class SnapshotService {
  constructor(private readonly prisma: PrismaService) {}

  async create(scenarioId: string, dto: CreateSnapshotDto): Promise<SnapshotWithFinancials> {
    const scenario = await this.prisma.scenario.findUnique({ where: { id: scenarioId } });

    if (!scenario) {
      throw new NotFoundException(`Scenario with id ${scenarioId} not found`);
    }

    const snapshot = await this.prisma.snapshot.create({
      data: {
        scenarioId,
        label: dto.label,
        model: scenario.model,
        avgInputTokens: scenario.avgInputTokens,
        avgOutputTokens: scenario.avgOutputTokens,
        requestsPerUser: scenario.requestsPerUser,
        projectedUsers: scenario.projectedUsers,
        subscriptionPrice: scenario.subscriptionPrice,
      },
    });

    return this.attachFinancials(snapshot);
  }

  async listByScenario(scenarioId: string): Promise<SnapshotWithFinancials[]> {
    const scenario = await this.prisma.scenario.findUnique({ where: { id: scenarioId } });

    if (!scenario) {
      throw new NotFoundException(`Scenario with id ${scenarioId} not found`);
    }

    const snapshots = await this.prisma.snapshot.findMany({
      where: { scenarioId },
      orderBy: { createdAt: 'desc' },
    });

    return snapshots.map((s) => this.attachFinancials(s));
  }

  async compare(snapshotIds: string[]): Promise<SnapshotComparison> {
    const snapshots = await this.prisma.snapshot.findMany({
      where: { id: { in: snapshotIds } },
      orderBy: { createdAt: 'asc' },
    });

    if (snapshots.length !== snapshotIds.length) {
      const foundIds = new Set(snapshots.map((s) => s.id));
      const missing = snapshotIds.filter((id) => !foundIds.has(id));
      throw new NotFoundException(`Snapshots not found: ${missing.join(', ')}`);
    }

    return {
      snapshots: snapshots.map((s) => this.attachFinancials(s)),
    };
  }

  private attachFinancials(snapshot: SnapshotRecord): SnapshotWithFinancials {
    const costPerRequest = calculatePerRequestCost(
      snapshot.model,
      snapshot.avgInputTokens,
      snapshot.avgOutputTokens,
    );
    const costPerUser = calculateCostPerUser(costPerRequest, snapshot.requestsPerUser);
    const monthlyCost = calculateMonthlyCost(
      costPerRequest,
      snapshot.requestsPerUser,
      snapshot.projectedUsers,
    );
    const grossMargin = calculateGrossMargin(snapshot.subscriptionPrice, costPerUser);
    const riskLevel = assessRisk(grossMargin);

    const financialResult: FinancialResult = {
      costPerRequest,
      costPerUser,
      monthlyCost,
      grossMargin,
      riskLevel,
    };

    return { ...snapshot, financialResult };
  }
}
