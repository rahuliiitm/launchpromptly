import { Module } from '@nestjs/common';
import { ProjectModule } from '../project/project.module';
import { AuditModule } from '../audit/audit.module';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { FeedbackController } from './feedback.controller';
import { FeedbackService } from './feedback.service';

@Module({
  imports: [ProjectModule, AuditModule],
  controllers: [FeedbackController],
  providers: [FeedbackService, ApiKeyGuard],
  exports: [FeedbackService],
})
export class FeedbackModule {}
