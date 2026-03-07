import { Injectable, ForbiddenException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../crypto/crypto.service';
import { AuditService } from '../audit/audit.service';
import { AlertService } from '../alert/alert.service';
import { UsageService } from '../billing/usage.service';
import type { IngestBatchDto, IngestEventDto } from './dto/ingest-batch.dto';

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

    const records = dto.events.map((e) => this.buildEventRecord(projectId, e, environmentId));

    await this.prisma.lLMEvent.createMany({ data: records });

    // Fire-and-forget audit logging — don't block the response
    void this.writeAuditLogs(projectId, dto.events);

    // Fire-and-forget alert evaluation — must never affect ingestion
    void this.evaluateAlertsForBatch(projectId, dto.events);

    return { accepted: dto.events.length };
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

  private async writeAuditLogs(projectId: string, events: IngestEventDto[]): Promise<void> {
    try {
      const entries: Array<Parameters<AuditService['log']>[0]> = [];

      for (const e of events) {
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
