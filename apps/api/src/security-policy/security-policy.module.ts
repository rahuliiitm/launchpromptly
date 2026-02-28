import { Module } from '@nestjs/common';
import { SecurityPolicyController } from './security-policy.controller';
import { SecurityPolicyService } from './security-policy.service';
import { ProjectModule } from '../project/project.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [ProjectModule, AuditModule],
  controllers: [SecurityPolicyController],
  providers: [SecurityPolicyService],
  exports: [SecurityPolicyService],
})
export class SecurityPolicyModule {}
