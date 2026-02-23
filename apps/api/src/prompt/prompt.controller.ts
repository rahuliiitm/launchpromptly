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
  HttpCode,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PromptService } from './prompt.service';
import { CreateManagedPromptDto } from './dto/create-managed-prompt.dto';
import { UpdateManagedPromptDto } from './dto/update-managed-prompt.dto';
import { CreatePromptVersionDto } from './dto/create-prompt-version.dto';
import type { Request } from 'express';

interface AuthUser {
  userId: string;
  email: string;
}

@Controller('prompt')
@UseGuards(JwtAuthGuard)
export class PromptController {
  constructor(private readonly promptService: PromptService) {}

  @Post(':projectId')
  async create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateManagedPromptDto,
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;
    return this.promptService.createPrompt(projectId, user.userId, dto);
  }

  @Get(':projectId')
  async list(
    @Param('projectId') projectId: string,
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;
    return this.promptService.listPrompts(projectId, user.userId);
  }

  @Get(':projectId/:promptId')
  async get(
    @Param('projectId') projectId: string,
    @Param('promptId') promptId: string,
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;
    return this.promptService.getPrompt(projectId, promptId, user.userId);
  }

  @Patch(':projectId/:promptId')
  async update(
    @Param('projectId') projectId: string,
    @Param('promptId') promptId: string,
    @Body() dto: UpdateManagedPromptDto,
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;
    return this.promptService.updatePrompt(projectId, promptId, user.userId, dto);
  }

  @Delete(':projectId/:promptId')
  async remove(
    @Param('projectId') projectId: string,
    @Param('promptId') promptId: string,
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;
    return this.promptService.deletePrompt(projectId, promptId, user.userId);
  }

  @Post(':projectId/:promptId/versions')
  async createVersion(
    @Param('projectId') projectId: string,
    @Param('promptId') promptId: string,
    @Body() dto: CreatePromptVersionDto,
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;
    return this.promptService.createVersion(projectId, promptId, user.userId, dto);
  }

  @Post(':projectId/:promptId/versions/:versionId/deploy')
  @HttpCode(200)
  async deploy(
    @Param('projectId') projectId: string,
    @Param('promptId') promptId: string,
    @Param('versionId') versionId: string,
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;
    return this.promptService.deployVersion(projectId, promptId, versionId, user.userId);
  }

  @Post(':projectId/:promptId/rollback')
  @HttpCode(200)
  async rollback(
    @Param('projectId') projectId: string,
    @Param('promptId') promptId: string,
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;
    return this.promptService.rollbackVersion(projectId, promptId, user.userId);
  }

  @Post(':projectId/promote/:templateHash')
  async promote(
    @Param('projectId') projectId: string,
    @Param('templateHash') templateHash: string,
    @Body() body: { slug: string; name: string },
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;
    return this.promptService.promoteTemplate(
      projectId,
      templateHash,
      user.userId,
      body.slug,
      body.name,
    );
  }
}
