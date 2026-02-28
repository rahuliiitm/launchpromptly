import { Module } from '@nestjs/common';
import { IncidentController } from './incident.controller';
import { IncidentService } from './incident.service';
import { ProjectModule } from '../project/project.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [ProjectModule, AuditModule],
  controllers: [IncidentController],
  providers: [IncidentService],
  exports: [IncidentService],
})
export class IncidentModule {}
