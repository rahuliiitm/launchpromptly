import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectService } from '../project/project.service';
import { AuditService } from '../audit/audit.service';
import type { CreateAlertRuleDto } from './dto/create-alert-rule.dto';
import type { UpdateAlertRuleDto } from './dto/update-alert-rule.dto';

export interface AlertRuleRecord {
  id: string;
  projectId: string;
  name: string;
  condition: unknown;
  channel: string;
  webhookUrl: string | null;
  email: string | null;
  throttleMinutes: number;
  enabled: boolean;
  lastFiredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface AlertEventData {
  piiDetectionCount?: number | null;
  injectionAction?: string | null;
  costUsd?: number;
  contentViolations?: {
    inputViolations: Array<{ category: string; matched: string; severity: string }>;
    outputViolations: Array<{ category: string; matched: string; severity: string }>;
  };
  [key: string]: unknown;
}

interface AlertCondition {
  type: string;
  threshold?: number;
}

@Injectable()
export class AlertService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectService: ProjectService,
    private readonly audit: AuditService,
  ) {}

  async create(
    projectId: string,
    userId: string,
    dto: CreateAlertRuleDto,
  ): Promise<AlertRuleRecord> {
    await this.projectService.assertProjectAccess(projectId, userId);

    const rule = await this.prisma.alertRule.create({
      data: {
        projectId,
        name: dto.name,
        condition: dto.condition as Prisma.InputJsonValue,
        ...(dto.channel !== undefined && { channel: dto.channel }),
        ...(dto.webhookUrl !== undefined && { webhookUrl: dto.webhookUrl }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.throttleMinutes !== undefined && { throttleMinutes: dto.throttleMinutes }),
        ...(dto.enabled !== undefined && { enabled: dto.enabled }),
      },
    });

    void this.audit.log({
      projectId,
      eventType: 'alert_rule_created',
      severity: 'info',
      details: { ruleId: rule.id, name: rule.name, condition: dto.condition },
      actorId: userId,
    });

    return rule;
  }

  async findAll(projectId: string, userId: string): Promise<AlertRuleRecord[]> {
    await this.projectService.assertProjectAccess(projectId, userId);

    return this.prisma.alertRule.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(
    projectId: string,
    userId: string,
    ruleId: string,
  ): Promise<AlertRuleRecord> {
    await this.projectService.assertProjectAccess(projectId, userId);

    const rule = await this.prisma.alertRule.findFirst({
      where: { id: ruleId, projectId },
    });

    if (!rule) {
      throw new NotFoundException('Alert rule not found');
    }

    return rule;
  }

  async update(
    projectId: string,
    userId: string,
    ruleId: string,
    dto: UpdateAlertRuleDto,
  ): Promise<AlertRuleRecord> {
    await this.projectService.assertProjectAccess(projectId, userId);

    const existing = await this.prisma.alertRule.findFirst({
      where: { id: ruleId, projectId },
    });

    if (!existing) {
      throw new NotFoundException('Alert rule not found');
    }

    const rule = await this.prisma.alertRule.update({
      where: { id: ruleId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.condition !== undefined && { condition: dto.condition as Prisma.InputJsonValue }),
        ...(dto.channel !== undefined && { channel: dto.channel }),
        ...(dto.webhookUrl !== undefined && { webhookUrl: dto.webhookUrl }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.throttleMinutes !== undefined && { throttleMinutes: dto.throttleMinutes }),
        ...(dto.enabled !== undefined && { enabled: dto.enabled }),
      },
    });

    void this.audit.log({
      projectId,
      eventType: 'alert_rule_updated',
      severity: 'info',
      details: { ruleId: rule.id, changes: dto },
      actorId: userId,
    });

    return rule;
  }

  async remove(projectId: string, userId: string, ruleId: string): Promise<void> {
    await this.projectService.assertProjectAccess(projectId, userId);

    const existing = await this.prisma.alertRule.findFirst({
      where: { id: ruleId, projectId },
    });

    if (!existing) {
      throw new NotFoundException('Alert rule not found');
    }

    await this.prisma.alertRule.delete({ where: { id: ruleId } });

    void this.audit.log({
      projectId,
      eventType: 'alert_rule_deleted',
      severity: 'info',
      details: { ruleId, name: existing.name },
      actorId: userId,
    });
  }

  /**
   * Evaluate all enabled alert rules for a project against the given event data.
   * Called fire-and-forget after event ingestion -- errors must never propagate.
   */
  async evaluateAlerts(projectId: string, eventData: AlertEventData): Promise<void> {
    const rules = await this.prisma.alertRule.findMany({
      where: { projectId, enabled: true },
    });

    const now = new Date();

    for (const rule of rules) {
      try {
        // Throttle check: skip if fired recently
        if (rule.lastFiredAt) {
          const cooldownMs = rule.throttleMinutes * 60 * 1000;
          if (now.getTime() - rule.lastFiredAt.getTime() < cooldownMs) {
            continue;
          }
        }

        const condition = rule.condition as unknown as AlertCondition;
        const shouldFire = this.evaluateCondition(condition, eventData);

        if (shouldFire) {
          // Update lastFiredAt
          await this.prisma.alertRule.update({
            where: { id: rule.id },
            data: { lastFiredAt: now },
          });

          // Deliver alert fire-and-forget
          void this.deliverAlert(rule, eventData);
        }
      } catch {
        // Individual rule evaluation failures must not affect other rules
      }
    }
  }

  private evaluateCondition(condition: AlertCondition, eventData: AlertEventData): boolean {
    switch (condition.type) {
      case 'pii_threshold': {
        const count = eventData.piiDetectionCount ?? 0;
        return count > (condition.threshold ?? 0);
      }

      case 'injection_blocked': {
        return eventData.injectionAction === 'block';
      }

      case 'cost_exceeded': {
        const cost = eventData.costUsd ?? 0;
        return cost > (condition.threshold ?? 0);
      }

      case 'content_violation': {
        if (!eventData.contentViolations) return false;
        const totalViolations =
          eventData.contentViolations.inputViolations.length +
          eventData.contentViolations.outputViolations.length;
        return totalViolations > 0;
      }

      default:
        return false;
    }
  }

  private async deliverAlert(
    rule: AlertRuleRecord,
    eventData: AlertEventData,
  ): Promise<void> {
    try {
      if (rule.channel === 'webhook' && rule.webhookUrl) {
        const payload = {
          alertName: rule.name,
          projectId: rule.projectId,
          condition: rule.condition,
          eventData,
          firedAt: new Date().toISOString(),
        };

        await fetch(rule.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10_000),
        });
      }

      // Log successful delivery attempt
      void this.audit.log({
        projectId: rule.projectId,
        eventType: 'alert_delivered',
        severity: 'info',
        details: {
          ruleId: rule.id,
          ruleName: rule.name,
          channel: rule.channel,
          condition: rule.condition,
        },
      });
    } catch {
      // Log failed delivery attempt -- never throw
      void this.audit.log({
        projectId: rule.projectId,
        eventType: 'alert_delivery_failed',
        severity: 'warning',
        details: {
          ruleId: rule.id,
          ruleName: rule.name,
          channel: rule.channel,
        },
      });
    }
  }
}
