import { Module } from '@nestjs/common';
import { SecurityPolicyController, SDKPolicyController } from './security-policy.controller';
import { SecurityPolicyService } from './security-policy.service';
import { ProjectModule } from '../project/project.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [ProjectModule, AuditModule],
  controllers: [SecurityPolicyController, SDKPolicyController],
  providers: [SecurityPolicyService],
  exports: [SecurityPolicyService],
})
export class SecurityPolicyModule {}
