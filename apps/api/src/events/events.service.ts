import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { IngestBatchDto } from './dto/ingest-batch.dto';

interface IngestResult {
  accepted: number;
}

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  async ingestBatch(projectId: string, dto: IngestBatchDto): Promise<IngestResult> {
    await this.prisma.lLMEvent.createMany({
      data: dto.events.map((e) => ({
        projectId,
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
        promptPreview: e.promptPreview ?? null,
        statusCode: e.statusCode ?? 200,
        managedPromptId: e.managedPromptId ?? null,
        promptVersionId: e.promptVersionId ?? null,
      })),
    });

    return { accepted: dto.events.length };
  }
}
