import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { SecurityPolicyService } from './security-policy.service';
import { AuditService } from '../audit/audit.service';
import { CreatePolicyDto } from './dto/create-policy.dto';
import { UpdatePolicyDto } from './dto/update-policy.dto';
import type { AuthUser } from '../auth/jwt.strategy';

// ── Admin endpoints (JWT auth) ─────────────────────────────────────────────

@Controller('v1/security/policies')
@UseGuards(JwtAuthGuard)
export class SecurityPolicyController {
  constructor(
    private readonly securityPolicyService: SecurityPolicyService,
    private readonly audit: AuditService,
  ) {}

  @Post(':projectId')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async create(
    @Param('projectId') projectId: string,
    @Body() dto: CreatePolicyDto,
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;
    const result = await this.securityPolicyService.create(projectId, user.userId, dto);
    void this.audit.log({
      projectId,
      eventType: 'policy_created',
      severity: 'info',
      details: { policyName: dto.name },
      actorId: user.userId,
    });
    return result;
  }

  @Get(':projectId')
  async findAll(
    @Param('projectId') projectId: string,
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;
    return this.securityPolicyService.findAll(projectId, user.userId);
  }

  @Get(':projectId/:policyId')
  async findOne(
    @Param('projectId') projectId: string,
    @Param('policyId') policyId: string,
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;
    return this.securityPolicyService.findOne(projectId, user.userId, policyId);
  }

  @Patch(':projectId/:policyId')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async update(
    @Param('projectId') projectId: string,
    @Param('policyId') policyId: string,
    @Body() dto: UpdatePolicyDto,
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;
    const result = await this.securityPolicyService.update(
      projectId,
      user.userId,
      policyId,
      dto,
    );
    void this.audit.log({
      projectId,
      eventType: 'policy_updated',
      severity: 'info',
      details: { policyId, changes: dto },
      actorId: user.userId,
    });
    return result;
  }

  @Delete(':projectId/:policyId')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async remove(
    @Param('projectId') projectId: string,
    @Param('policyId') policyId: string,
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;
    const result = await this.securityPolicyService.remove(projectId, user.userId, policyId);
    void this.audit.log({
      projectId,
      eventType: 'policy_deleted',
      severity: 'warning',
      details: { policyId },
      actorId: user.userId,
    });
    return result;
  }
}

// ── SDK endpoint (API key auth) ────────────────────────────────────────────

@Controller('v1/sdk/policy')
@UseGuards(ApiKeyGuard)
export class SDKPolicyController {
  constructor(private readonly securityPolicyService: SecurityPolicyService) {}

  @Get()
  async getActivePolicy(@Req() req: Request) {
    const projectId = (req as Request & { projectId: string }).projectId;
    const policy = await this.securityPolicyService.getActivePolicy(projectId);
    if (!policy) {
      return { rules: null };
    }
    return { rules: policy.rules, updatedAt: policy.updatedAt };
  }
}
