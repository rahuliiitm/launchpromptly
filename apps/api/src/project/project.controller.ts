import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ProjectService } from './project.service';
import { AuditService } from '../audit/audit.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { UpdateRetentionDto } from './dto/update-retention.dto';
import type { AuthUser } from '../auth/jwt.strategy';

@Controller('project')
@UseGuards(JwtAuthGuard)
export class ProjectController {
  constructor(
    private readonly projectService: ProjectService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  async listProjects(@Req() req: Request): Promise<unknown> {
    const user = req.user as AuthUser;
    return this.projectService.listProjects(user.userId);
  }

  @Get(':id')
  async getProject(
    @Param('id') projectId: string,
    @Req() req: Request,
  ): Promise<unknown> {
    const user = req.user as AuthUser;
    return this.projectService.getProject(projectId, user.userId);
  }

  @Get(':id/api-keys')
  async listApiKeys(
    @Param('id') projectId: string,
    @Req() req: Request,
  ): Promise<unknown> {
    const user = req.user as AuthUser;
    return this.projectService.listApiKeys(projectId, user.userId);
  }

  @Post(':id/api-keys')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async generateApiKey(
    @Param('id') projectId: string,
    @Body() dto: CreateApiKeyDto,
    @Req() req: Request,
  ): Promise<unknown> {
    const user = req.user as AuthUser;
    const result = await this.projectService.generateApiKey(
      projectId,
      user.userId,
      dto.name ?? 'Default',
      dto.environmentId,
      dto.expiresInDays,
    );
    void this.audit.log({
      projectId,
      eventType: 'api_key_created',
      severity: 'info',
      details: { keyPrefix: result.apiKey.keyPrefix, name: result.apiKey.name },
      actorId: user.userId,
    });
    return result;
  }

  @Patch(':id/retention')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async updateRetention(
    @Param('id') projectId: string,
    @Body() dto: UpdateRetentionDto,
    @Req() req: Request,
  ): Promise<unknown> {
    const user = req.user as AuthUser;
    const result = await this.projectService.updateRetention(projectId, user.userId, dto.retentionDays);
    void this.audit.log({
      projectId,
      eventType: 'retention_updated',
      severity: 'info',
      details: { retentionDays: dto.retentionDays },
      actorId: user.userId,
    });
    return result;
  }

  @Delete(':id/api-keys/:keyId')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async revokeApiKey(
    @Param('id') projectId: string,
    @Param('keyId') keyId: string,
    @Req() req: Request,
  ): Promise<void> {
    const user = req.user as AuthUser;
    await this.projectService.revokeApiKey(projectId, keyId, user.userId);
    void this.audit.log({
      projectId,
      eventType: 'api_key_revoked',
      severity: 'warning',
      details: { keyId },
      actorId: user.userId,
    });
  }
}
