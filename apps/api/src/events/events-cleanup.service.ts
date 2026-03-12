import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class EventsCleanupService {
  private readonly logger = new Logger(EventsCleanupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleRetentionCleanup(): Promise<void> {
    this.logger.log('Starting data retention cleanup...');

    const projects = await this.prisma.project.findMany({
      select: { id: true, retentionDays: true },
    });

    let totalDeleted = 0;

    for (const project of projects) {
      const cutoff = new Date(Date.now() - project.retentionDays * 24 * 60 * 60 * 1000);

      const result = await this.prisma.lLMEvent.deleteMany({
        where: {
          projectId: project.id,
          createdAt: { lt: cutoff },
        },
      });

      if (result.count > 0) {
        totalDeleted += result.count;
        await this.audit.log({
          projectId: project.id,
          eventType: 'retention_cleanup',
          severity: 'info',
          details: {
            deletedCount: result.count,
            retentionDays: project.retentionDays,
            cutoffDate: cutoff.toISOString(),
          },
        });
      }
    }

    this.logger.log(`Retention cleanup complete. Deleted ${totalDeleted} events across ${projects.length} projects.`);
  }
}
