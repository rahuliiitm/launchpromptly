import { Module } from '@nestjs/common';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { AuditModule } from '../audit/audit.module';
import { AlertModule } from '../alert/alert.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [AuditModule, AlertModule, BillingModule],
  controllers: [EventsController],
  providers: [EventsService, ApiKeyGuard],
})
export class EventsModule {}
