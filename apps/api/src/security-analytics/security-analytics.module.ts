import { Module } from '@nestjs/common';
import { ProjectModule } from '../project/project.module';
import { SecurityAnalyticsController } from './security-analytics.controller';
import { SecurityAnalyticsService } from './security-analytics.service';

@Module({
  imports: [ProjectModule],
  controllers: [SecurityAnalyticsController],
  providers: [SecurityAnalyticsService],
  exports: [SecurityAnalyticsService],
})
export class SecurityAnalyticsModule {}
