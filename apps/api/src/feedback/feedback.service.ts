import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectService } from '../project/project.service';
import { AuditService } from '../audit/audit.service';
import type { SubmitFeedbackDto } from './dto/submit-feedback.dto';
import type { QueryFeedbackDto } from './dto/query-feedback.dto';

export interface FeedbackRecord {
  id: string;
  projectId: string;
  eventId: string;
  userId: string;
  guardrailType: string;
  originalAction: string;
  feedback: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FeedbackSummary {
  total: number;
  correct: number;
  falsePositive: number;
  falseNegative: number;
  byGuardrailType: { guardrailType: string; count: number }[];
}

@Injectable()
export class FeedbackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectService: ProjectService,
    private readonly audit: AuditService,
  ) {}

  async submit(
    projectId: string,
    eventId: string,
    userId: string,
    dto: SubmitFeedbackDto,
  ): Promise<FeedbackRecord> {
    await this.projectService.assertProjectAccess(projectId, userId);

    // Verify event exists and belongs to project
    const event = await this.prisma.lLMEvent.findFirst({
      where: { id: eventId, projectId },
    });
    if (!event) {
      throw new NotFoundException('Event not found');
    }

    // Upsert: one feedback per user per event per guardrail type
    const feedback = await this.prisma.detectionFeedback.upsert({
      where: {
        eventId_userId_guardrailType: {
          eventId,
          userId,
          guardrailType: dto.guardrailType,
        },
      },
      update: {
        originalAction: dto.originalAction,
        feedback: dto.feedback,
        notes: dto.notes ?? null,
      },
      create: {
        projectId,
        eventId,
        userId,
        guardrailType: dto.guardrailType,
        originalAction: dto.originalAction,
        feedback: dto.feedback,
        notes: dto.notes ?? null,
      },
    });

    void this.audit.log({
      projectId,
      eventType: 'detection_feedback_submitted',
      severity: 'info',
      details: {
        eventId,
        guardrailType: dto.guardrailType,
        feedback: dto.feedback,
        originalAction: dto.originalAction,
      },
      eventId,
      actorId: userId,
    });

    return feedback;
  }

  async submitFromSdk(
    projectId: string,
    eventId: string,
    dto: SubmitFeedbackDto,
  ): Promise<FeedbackRecord> {
    const event = await this.prisma.lLMEvent.findFirst({
      where: { id: eventId, projectId },
    });
    if (!event) {
      throw new NotFoundException('Event not found');
    }

    const userId = 'sdk';

    const feedback = await this.prisma.detectionFeedback.upsert({
      where: {
        eventId_userId_guardrailType: {
          eventId,
          userId,
          guardrailType: dto.guardrailType,
        },
      },
      update: {
        originalAction: dto.originalAction,
        feedback: dto.feedback,
        notes: dto.notes ?? null,
      },
      create: {
        projectId,
        eventId,
        userId,
        guardrailType: dto.guardrailType,
        originalAction: dto.originalAction,
        feedback: dto.feedback,
        notes: dto.notes ?? null,
      },
    });

    void this.audit.log({
      projectId,
      eventType: 'detection_feedback_submitted',
      severity: 'info',
      details: {
        eventId,
        guardrailType: dto.guardrailType,
        feedback: dto.feedback,
        source: 'sdk',
      },
      eventId,
    });

    return feedback;
  }

  async getForEvent(
    projectId: string,
    eventId: string,
    userId: string,
  ): Promise<FeedbackRecord[]> {
    await this.projectService.assertProjectAccess(projectId, userId);

    return this.prisma.detectionFeedback.findMany({
      where: { eventId, projectId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async query(
    projectId: string,
    userId: string,
    dto: QueryFeedbackDto,
  ): Promise<{ items: FeedbackRecord[]; total: number; page: number; limit: number }> {
    await this.projectService.assertProjectAccess(projectId, userId);

    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const days = dto.days ?? 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const where: Record<string, unknown> = {
      projectId,
      createdAt: { gte: since },
    };
    if (dto.guardrailType) where.guardrailType = dto.guardrailType;
    if (dto.feedback) where.feedback = dto.feedback;

    const [items, total] = await Promise.all([
      this.prisma.detectionFeedback.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.detectionFeedback.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async summary(
    projectId: string,
    userId: string,
    days = 30,
  ): Promise<FeedbackSummary> {
    await this.projectService.assertProjectAccess(projectId, userId);

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const where = { projectId, createdAt: { gte: since } };

    const [total, correct, falsePositive, falseNegative, byType] = await Promise.all([
      this.prisma.detectionFeedback.count({ where }),
      this.prisma.detectionFeedback.count({ where: { ...where, feedback: 'correct' } }),
      this.prisma.detectionFeedback.count({ where: { ...where, feedback: 'false_positive' } }),
      this.prisma.detectionFeedback.count({ where: { ...where, feedback: 'false_negative' } }),
      this.prisma.detectionFeedback.groupBy({
        by: ['guardrailType'],
        where,
        _count: true,
      }),
    ]);

    return {
      total,
      correct,
      falsePositive,
      falseNegative,
      byGuardrailType: byType.map((g) => ({
        guardrailType: g.guardrailType,
        count: g._count,
      })),
    };
  }
}
