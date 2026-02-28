import {
  Controller,
  Get,
  Post,
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
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import type { AuthUser } from '../auth/jwt.strategy';

@Controller('project')
@UseGuards(JwtAuthGuard)
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Get()
  async listProjects(@Req() req: Request): Promise<unknown> {
    const user = req.user as AuthUser;
    return this.projectService.listProjects(user.userId);
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
    return this.projectService.generateApiKey(
      projectId,
      user.userId,
      dto.name ?? 'Default',
      dto.environmentId,
    );
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
    return this.projectService.revokeApiKey(projectId, keyId, user.userId);
  }
}
