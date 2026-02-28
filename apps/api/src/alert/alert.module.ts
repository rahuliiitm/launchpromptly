import { Module } from '@nestjs/common';
import { ProjectModule } from '../project/project.module';
import { AuditModule } from '../audit/audit.module';
import { AlertController } from './alert.controller';
import { AlertService } from './alert.service';

@Module({
  imports: [ProjectModule, AuditModule],
  controllers: [AlertController],
  providers: [AlertService],
  exports: [AlertService],
})
export class AlertModule {}
