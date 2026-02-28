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
import { SecurityPolicyService } from './security-policy.service';
import { CreatePolicyDto } from './dto/create-policy.dto';
import { UpdatePolicyDto } from './dto/update-policy.dto';
import type { AuthUser } from '../auth/jwt.strategy';

@Controller('v1/security/policies')
@UseGuards(JwtAuthGuard)
export class SecurityPolicyController {
  constructor(private readonly securityPolicyService: SecurityPolicyService) {}

  @Post(':projectId')
  async create(
    @Param('projectId') projectId: string,
    @Body() dto: CreatePolicyDto,
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;
    return this.securityPolicyService.create(projectId, user.userId, dto);
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
  async update(
    @Param('projectId') projectId: string,
    @Param('policyId') policyId: string,
    @Body() dto: UpdatePolicyDto,
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;
    return this.securityPolicyService.update(
      projectId,
      user.userId,
      policyId,
      dto,
    );
  }

  @Delete(':projectId/:policyId')
  async remove(
    @Param('projectId') projectId: string,
    @Param('policyId') policyId: string,
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;
    return this.securityPolicyService.remove(projectId, user.userId, policyId);
  }
}
