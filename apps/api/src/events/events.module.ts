import { Module } from '@nestjs/common';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { EventsCleanupService } from './events-cleanup.service';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { AuditModule } from '../audit/audit.module';
import { AlertModule } from '../alert/alert.module';
import { BillingModule } from '../billing/billing.module';
import { ProjectModule } from '../project/project.module';

@Module({
  imports: [AuditModule, AlertModule, BillingModule, ProjectModule],
  controllers: [EventsController],
  providers: [EventsService, EventsCleanupService, ApiKeyGuard],
})
export class EventsModule {}
