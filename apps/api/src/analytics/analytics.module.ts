import { Module } from '@nestjs/common';
import { ProjectModule } from '../project/project.module';
import { ProviderKeyModule } from '../provider-key/provider-key.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { OptimizationService } from './optimization.service';
import { RagAnalyticsService } from './rag-analytics.service';
import { RagEvaluationService } from './rag-evaluation.service';
import { SecurityAnalyticsService } from './security-analytics.service';

@Module({
  imports: [ProjectModule, ProviderKeyModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, OptimizationService, RagAnalyticsService, RagEvaluationService, SecurityAnalyticsService],
  exports: [AnalyticsService, RagAnalyticsService, SecurityAnalyticsService],
})
export class AnalyticsModule {}
