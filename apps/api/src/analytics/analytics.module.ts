import { Module } from '@nestjs/common';
import { ProjectModule } from '../project/project.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { OptimizationService } from './optimization.service';

@Module({
  imports: [ProjectModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, OptimizationService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
