import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface MonthlyUsage {
  eventCount: number;
  eventLimit: number;
  periodStart: string;
  periodEnd: string;
  percentUsed: number;
  plan: string;
}

export interface QuotaCheck {
  allowed: boolean;
  remaining: number;
  limit: number;
}

@Injectable()
export class UsageService {
  constructor(private readonly prisma: PrismaService) {}

  async getMonthlyUsage(organizationId: string): Promise<MonthlyUsage> {
    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { plan: true },
    });

    const limit = this.getEventLimit(org.plan);
    const { start, end } = this.getCurrentPeriod();

    const eventCount = await this.countEvents(organizationId, start);

    const percentUsed = limit === 0 ? 0 : Math.round((eventCount / limit) * 100);

    return {
      eventCount,
      eventLimit: limit,
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
      percentUsed: Math.min(percentUsed, 100),
      plan: org.plan,
    };
  }

  async checkQuota(projectId: string): Promise<QuotaCheck> {
    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { organizationId: true },
    });

    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: project.organizationId },
      select: { plan: true },
    });

    const limit = this.getEventLimit(org.plan);

    // Unlimited plans always pass
    if (limit === -1) {
      return { allowed: true, remaining: -1, limit: -1 };
    }

    const { start } = this.getCurrentPeriod();
    const eventCount = await this.countEvents(project.organizationId, start);
    const remaining = Math.max(limit - eventCount, 0);

    return {
      allowed: eventCount < limit,
      remaining,
      limit,
    };
  }

  private getEventLimit(plan: string): number {
    // Beta period: all plans get 100K events until April 30, 2025
    if (new Date() < new Date('2025-04-30T23:59:59Z')) {
      return 100_000;
    }

    switch (plan) {
      case 'pro':
        return 10_000;
      case 'business':
        return 100_000;
      case 'free':
      default:
        return 1_000;
    }
  }

  private getCurrentPeriod(): { start: Date; end: Date } {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end };
  }

  private async countEvents(organizationId: string, since: Date): Promise<number> {
    // Get all projects belonging to this org
    const projects = await this.prisma.project.findMany({
      where: { organizationId },
      select: { id: true },
    });

    if (projects.length === 0) return 0;

    const projectIds = projects.map((p) => p.id);

    const count = await this.prisma.lLMEvent.count({
      where: {
        projectId: { in: projectIds },
        createdAt: { gte: since },
      },
    });

    return count;
  }
}
