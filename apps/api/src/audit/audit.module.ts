import { Module, forwardRef } from '@nestjs/common';
import { ProjectModule } from '../project/project.module';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

@Module({
  imports: [forwardRef(() => ProjectModule)],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
