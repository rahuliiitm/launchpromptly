import { Module } from '@nestjs/common';
import { ProjectModule } from '../project/project.module';
import { AuditModule } from '../audit/audit.module';
import { ComplianceController } from './compliance.controller';
import { ComplianceService } from './compliance.service';
import { DsarService } from './dsar.service';
import { ReportService } from './report.service';

@Module({
  imports: [ProjectModule, AuditModule],
  controllers: [ComplianceController],
  providers: [ComplianceService, DsarService, ReportService],
  exports: [ComplianceService, DsarService, ReportService],
})
export class ComplianceModule {}
