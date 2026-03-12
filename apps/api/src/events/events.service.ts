import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../crypto/crypto.service';
import { AuditService } from '../audit/audit.service';
import { AlertService } from '../alert/alert.service';
import { UsageService } from '../billing/usage.service';
import { ProjectService } from '../project/project.service';
import type { IngestBatchDto, IngestEventDto } from './dto/ingest-batch.dto';
import type { DeleteEventsDto } from './dto/delete-events.dto';

interface IngestResult {
  accepted: number;
}

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
    private readonly alertService: AlertService,
    private readonly usageService: UsageService,
    private readonly projectService: ProjectService,
  ) {}

  async ingestBatch(projectId: string, dto: IngestBatchDto, environmentId?: string): Promise<IngestResult> {
    // Check plan quota before ingesting
    const quota = await this.usageService.checkQuota(projectId);
    if (!quota.allowed) {
      throw new ForbiddenException(
        `Monthly event limit reached (${quota.limit.toLocaleString()} events on your current plan). ` +
        'Upgrade your plan to continue ingesting events.',
      );
    }

    const records = dto.events.map((e) => ({
      id: randomUUID(),
      ...this.buildEventRecord(projectId, e, environmentId),
    }));

    await this.prisma.lLMEvent.createMany({ data: records });

    // Fire-and-forget audit logging — don't block the response
    void this.writeAuditLogs(projectId, dto.events, records.map((r) => r.id));

    // Fire-and-forget alert evaluation — must never affect ingestion
    void this.evaluateAlertsForBatch(projectId, dto.events);

    return { accepted: dto.events.length };
  }

  async getEventDetail(projectId: string, eventId: string, userId: string) {
    await this.projectService.assertProjectAccess(projectId, userId);

    const event = await this.prisma.lLMEvent.findFirst({
      where: { id: eventId, projectId },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    // Decrypt sensitive fields
    let promptText: string | null = null;
    let responseText: string | null = null;

    if (event.encPromptPreview && event.encIv && event.encAuthTag) {
      try {
        const decrypted = this.crypto.decrypt(event.encPromptPreview, event.encIv, event.encAuthTag);
        const parsed = JSON.parse(decrypted);
        promptText = parsed.promptPreview ?? null;
        responseText = parsed.responseText ?? null;
      } catch {
        // Decryption may fail for corrupted data
      }
    }

    return {
      id: event.id,
      projectId: event.projectId,
      provider: event.provider,
      model: event.model,
      inputTokens: event.inputTokens,
      outputTokens: event.outputTokens,
      totalTokens: event.totalTokens,
      costUsd: event.costUsd,
      latencyMs: event.latencyMs,
      customerId: event.customerId,
      feature: event.feature,
      statusCode: event.statusCode,
      traceId: event.traceId,
      createdAt: event.createdAt,
      // Security fields
      piiDetectionCount: event.piiDetectionCount,
      piiTypes: event.piiTypes,
      injectionRiskScore: event.injectionRiskScore,
      injectionAction: event.injectionAction,
      redactionApplied: event.redactionApplied,
      securityMetadata: event.securityMetadata,
      // Decrypted text
      promptText,
      responseText,
    };
  }

  async deleteEvents(
    projectId: string,
    userId: string,
    dto: DeleteEventsDto,
  ): Promise<{ deletedCount: number }> {
    if (!dto.customerId && !dto.olderThanDays) {
      throw new BadRequestException('Provide at least one of: customerId, olderThanDays');
    }

    await this.projectService.assertProjectAccess(projectId, userId);

    const where: Prisma.LLMEventWhereInput = { projectId };
    if (dto.customerId) where.customerId = dto.customerId;
    if (dto.olderThanDays) {
      where.createdAt = { lt: new Date(Date.now() - dto.olderThanDays * 24 * 60 * 60 * 1000) };
    }

    const result = await this.prisma.lLMEvent.deleteMany({ where });

    // Audit the deletion
    await this.audit.log({
      projectId,
      eventType: 'data_deletion',
      severity: 'warning',
      details: {
        deletedCount: result.count,
        customerId: dto.customerId ?? null,
        olderThanDays: dto.olderThanDays ?? null,
      },
      actorId: userId,
    });

    return { deletedCount: result.count };
  }

  private buildEventRecord(projectId: string, e: IngestEventDto, environmentId?: string) {
    // Encrypt sensitive fields — each field gets its own IV/authTag
    let encPromptPreview: string | null = null;
    let encResponseText: string | null = null;
    let encIv: string | null = null;
    let encAuthTag: string | null = null;

    // Combine both sensitive fields into one encrypted payload to use a single IV/authTag.
    // This avoids the previous bug where responseText's IV was discarded.
    const sensitivePayload: Record<string, string> = {};
    if (e.promptPreview) sensitivePayload.promptPreview = e.promptPreview;
    if (e.responseText) sensitivePayload.responseText = e.responseText;

    if (Object.keys(sensitivePayload).length > 0) {
      const enc = this.crypto.encrypt(JSON.stringify(sensitivePayload));
      encPromptPreview = e.promptPreview ? enc.encrypted : null;
      encResponseText = e.responseText ? enc.encrypted : null;
      encIv = enc.iv;
      encAuthTag = enc.authTag;
    }

    // Build security metadata
    const securityMetadata: Record<string, unknown> = {};
    if (e.piiDetections) securityMetadata.piiDetections = e.piiDetections;
    if (e.injectionRisk) securityMetadata.injectionRisk = e.injectionRisk;
    if (e.costGuard) securityMetadata.costGuard = e.costGuard;
    if (e.contentViolations) securityMetadata.contentViolations = e.contentViolations;
    if (e.jailbreakRisk) securityMetadata.jailbreakRisk = e.jailbreakRisk;
    if (e.unicodeThreats) securityMetadata.unicodeThreats = e.unicodeThreats;
    if (e.secretDetections) securityMetadata.secretDetections = e.secretDetections;
    if (e.topicViolation) securityMetadata.topicViolation = e.topicViolation;
    if (e.outputSafety) securityMetadata.outputSafety = e.outputSafety;
    if (e.promptLeakage) securityMetadata.promptLeakage = e.promptLeakage;
    return {
      projectId,
      environmentId: e.environmentId ?? environmentId ?? null,
      customerId: e.customerId ?? null,
      feature: e.feature ?? null,
      provider: e.provider,
      model: e.model,
      inputTokens: e.inputTokens,
      outputTokens: e.outputTokens,
      totalTokens: e.totalTokens,
      costUsd: e.costUsd,
      latencyMs: e.latencyMs,
      systemHash: e.systemHash ?? null,
      fullHash: e.fullHash ?? null,
      promptPreview: null,  // Never store plaintext — use encrypted field only
      statusCode: e.statusCode ?? 200,
      responseText: null,   // Never store plaintext — use encrypted field only
      traceId: e.traceId ?? randomUUID(),
      spanName: e.spanName ?? null,
      metadata: e.metadata ? (e.metadata as Prisma.InputJsonValue) : undefined,
      // Security fields
      piiDetectionCount: e.piiDetections ? (e.piiDetections.inputCount + e.piiDetections.outputCount) : null,
      piiTypes: e.piiDetections?.types ?? [],
      injectionRiskScore: e.injectionRisk?.score ?? null,
      injectionAction: e.injectionRisk?.action ?? null,
      redactionApplied: e.piiDetections?.redactionApplied ?? false,
      securityMetadata: Object.keys(securityMetadata).length > 0
        ? (securityMetadata as Prisma.InputJsonValue)
        : undefined,
      // Encrypted fields
      encPromptPreview,
      encResponseText,
      encIv,
      encAuthTag,
    };
  }

  private async writeAuditLogs(projectId: string, events: IngestEventDto[], eventIds: string[]): Promise<void> {
    try {
      const entries: Array<Parameters<AuditService['log']>[0]> = [];

      for (let i = 0; i < events.length; i++) {
        const e = events[i];
        if (e.piiDetections && (e.piiDetections.inputCount > 0 || e.piiDetections.outputCount > 0)) {
          const totalPii = e.piiDetections.inputCount + e.piiDetections.outputCount;
          entries.push({
            projectId,
            eventType: 'pii_detected',
            severity: totalPii > 5 ? 'warning' : 'info',
            details: {
              inputCount: e.piiDetections.inputCount,
              outputCount: e.piiDetections.outputCount,
              types: e.piiDetections.types,
              redactionApplied: e.piiDetections.redactionApplied,
              detectorUsed: e.piiDetections.detectorUsed,
            },
            eventId: eventIds[i],
            customerId: e.customerId,
          });
        }

        if (e.injectionRisk) {
          if (e.injectionRisk.action === 'block') {
            entries.push({
              projectId,
              eventType: 'injection_blocked',
              severity: 'critical',
              details: {
                score: e.injectionRisk.score,
                triggered: e.injectionRisk.triggered,
                detectorUsed: e.injectionRisk.detectorUsed,
              },
              eventId: eventIds[i],
              customerId: e.customerId,
            });
          } else if (e.injectionRisk.action === 'warn') {
            entries.push({
              projectId,
              eventType: 'injection_warned',
              severity: 'warning',
              details: {
                score: e.injectionRisk.score,
                triggered: e.injectionRisk.triggered,
              },
              eventId: eventIds[i],
              customerId: e.customerId,
            });
          }
        }

        if (e.contentViolations) {
          const allViolations = [
            ...e.contentViolations.inputViolations,
            ...e.contentViolations.outputViolations,
          ];
          if (allViolations.length > 0) {
            const hasBlocking = allViolations.some((v) => v.severity === 'block');
            entries.push({
              projectId,
              eventType: 'content_violation',
              severity: hasBlocking ? 'critical' : 'warning',
              details: { violations: allViolations },
              eventId: eventIds[i],
              customerId: e.customerId,
            });
          }
        }

        if (e.costGuard?.limitTriggered) {
          entries.push({
            projectId,
            eventType: 'cost_limit',
            severity: 'warning',
            details: {
              estimatedCost: e.costGuard.estimatedCost,
              budgetRemaining: e.costGuard.budgetRemaining,
              limitTriggered: e.costGuard.limitTriggered,
            },
            eventId: eventIds[i],
            customerId: e.customerId,
          });
        }

        if (e.jailbreakRisk) {
          if (e.jailbreakRisk.action === 'block') {
            entries.push({
              projectId,
              eventType: 'jailbreak_blocked',
              severity: 'critical',
              details: {
                score: e.jailbreakRisk.score,
                triggered: e.jailbreakRisk.triggered,
              },
              eventId: eventIds[i],
              customerId: e.customerId,
            });
          } else if (e.jailbreakRisk.action === 'warn') {
            entries.push({
              projectId,
              eventType: 'jailbreak_warned',
              severity: 'warning',
              details: {
                score: e.jailbreakRisk.score,
                triggered: e.jailbreakRisk.triggered,
              },
              eventId: eventIds[i],
              customerId: e.customerId,
            });
          }
        }

        if (e.unicodeThreats?.found) {
          entries.push({
            projectId,
            eventType: 'unicode_threat',
            severity: 'warning',
            details: {
              threatCount: e.unicodeThreats.threatCount,
              types: e.unicodeThreats.types,
              action: e.unicodeThreats.action,
            },
            eventId: eventIds[i],
            customerId: e.customerId,
          });
        }

        if (e.secretDetections && (e.secretDetections.inputCount + e.secretDetections.outputCount) > 0) {
          entries.push({
            projectId,
            eventType: 'secret_detected',
            severity: 'critical',
            details: {
              inputCount: e.secretDetections.inputCount,
              outputCount: e.secretDetections.outputCount,
              types: e.secretDetections.types,
            },
            eventId: eventIds[i],
            customerId: e.customerId,
          });
        }

        if (e.topicViolation) {
          entries.push({
            projectId,
            eventType: 'topic_violation',
            severity: 'warning',
            details: {
              type: e.topicViolation.type,
              topic: e.topicViolation.topic,
              matchedKeywords: e.topicViolation.matchedKeywords,
              score: e.topicViolation.score,
            },
            eventId: eventIds[i],
            customerId: e.customerId,
          });
        }

        if (e.outputSafety && e.outputSafety.threats.length > 0) {
          entries.push({
            projectId,
            eventType: 'output_safety',
            severity: 'warning',
            details: {
              threats: e.outputSafety.threats,
            },
            eventId: eventIds[i],
            customerId: e.customerId,
          });
        }

        if (e.promptLeakage?.leaked) {
          entries.push({
            projectId,
            eventType: 'prompt_leakage',
            severity: 'critical',
            details: {
              similarity: e.promptLeakage.similarity,
              metaResponseDetected: e.promptLeakage.metaResponseDetected,
            },
            eventId: eventIds[i],
            customerId: e.customerId,
          });
        }

      }

      // Write all audit entries individually (AuditService.log uses create, not createMany)
      if (entries.length > 0) {
        await Promise.all(entries.map((entry) => this.audit.log(entry)));
      }
    } catch {
      // Audit logging must never fail the main ingestion
    }
  }

  private async evaluateAlertsForBatch(projectId: string, events: IngestEventDto[]): Promise<void> {
    try {
      for (const e of events) {
        const eventData: Record<string, unknown> = {
          piiDetectionCount: e.piiDetections
            ? e.piiDetections.inputCount + e.piiDetections.outputCount
            : null,
          injectionAction: e.injectionRisk?.action ?? null,
          costUsd: e.costUsd,
          contentViolations: e.contentViolations ?? null,
        };

        await this.alertService.evaluateAlerts(projectId, eventData);
      }
    } catch {
      // Alert evaluation must never fail the main ingestion
    }
  }
}
