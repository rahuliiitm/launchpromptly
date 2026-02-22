import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  calculatePerRequestCost,
  calculateCostPerUser,
  calculateMonthlyCost,
  calculateGrossMargin,
  assessRisk,
  simulateArchitectures,
} from '@aiecon/calculators';
import type { FinancialResult, SimulationResult } from '@aiecon/types';
import { CreateScenarioDto } from './dto/create-scenario.dto';

export interface ScenarioWithFinancials {
  id: string;
  userId: string;
  name: string;
  model: string;
  avgInputTokens: number;
  avgOutputTokens: number;
  requestsPerUser: number;
  projectedUsers: number;
  subscriptionPrice: number;
  createdAt: Date;
  financialResult: FinancialResult;
}

@Injectable()
export class ScenarioService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateScenarioDto): Promise<ScenarioWithFinancials> {
    const scenario = await this.prisma.scenario.create({
      data: {
        userId,
        name: dto.name,
        model: dto.model,
        avgInputTokens: dto.avgInputTokens,
        avgOutputTokens: dto.avgOutputTokens,
        requestsPerUser: dto.requestsPerUser,
        projectedUsers: dto.projectedUsers,
        subscriptionPrice: dto.subscriptionPrice,
      },
    });

    return this.attachFinancials(scenario);
  }

  async findById(id: string): Promise<ScenarioWithFinancials> {
    const scenario = await this.prisma.scenario.findUnique({ where: { id } });

    if (!scenario) {
      throw new NotFoundException(`Scenario with id ${id} not found`);
    }

    return this.attachFinancials(scenario);
  }

  async getSimulations(id: string): Promise<SimulationResult[]> {
    const scenario = await this.prisma.scenario.findUnique({ where: { id } });

    if (!scenario) {
      throw new NotFoundException(`Scenario with id ${id} not found`);
    }

    return simulateArchitectures({
      avgInputTokens: scenario.avgInputTokens,
      avgOutputTokens: scenario.avgOutputTokens,
      requestsPerUser: scenario.requestsPerUser,
      projectedUsers: scenario.projectedUsers,
      subscriptionPrice: scenario.subscriptionPrice,
    });
  }

  private attachFinancials(scenario: {
    id: string;
    userId: string;
    name: string;
    model: string;
    avgInputTokens: number;
    avgOutputTokens: number;
    requestsPerUser: number;
    projectedUsers: number;
    subscriptionPrice: number;
    createdAt: Date;
  }): ScenarioWithFinancials {
    const costPerRequest = calculatePerRequestCost(
      scenario.model,
      scenario.avgInputTokens,
      scenario.avgOutputTokens,
    );
    const costPerUser = calculateCostPerUser(costPerRequest, scenario.requestsPerUser);
    const monthlyCost = calculateMonthlyCost(costPerRequest, scenario.requestsPerUser, scenario.projectedUsers);
    const grossMargin = calculateGrossMargin(scenario.subscriptionPrice, costPerUser);
    const riskLevel = assessRisk(grossMargin);

    return {
      ...scenario,
      financialResult: {
        costPerRequest,
        costPerUser,
        monthlyCost,
        grossMargin,
        riskLevel,
      },
    };
  }
}
