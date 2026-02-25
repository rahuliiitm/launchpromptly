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
import { EnvironmentService } from './environment.service';
import { CreateEnvironmentDto } from './dto/create-environment.dto';
import { UpdateEnvironmentDto } from './dto/update-environment.dto';
import type { Request } from 'express';

interface AuthUser {
  userId: string;
  email: string;
}

@Controller('environment')
@UseGuards(JwtAuthGuard)
export class EnvironmentController {
  constructor(private readonly environmentService: EnvironmentService) {}

  @Get(':projectId')
  async list(@Param('projectId') projectId: string, @Req() req: Request) {
    const user = req.user as AuthUser;
    return this.environmentService.listEnvironments(projectId, user.userId);
  }

  @Post(':projectId')
  async create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateEnvironmentDto,
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;
    return this.environmentService.createEnvironment(projectId, user.userId, dto);
  }

  @Patch(':projectId/:envId')
  async update(
    @Param('projectId') projectId: string,
    @Param('envId') envId: string,
    @Body() dto: UpdateEnvironmentDto,
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;
    return this.environmentService.updateEnvironment(projectId, envId, user.userId, dto);
  }

  @Delete(':projectId/:envId')
  @HttpCode(204)
  async remove(
    @Param('projectId') projectId: string,
    @Param('envId') envId: string,
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;
    await this.environmentService.deleteEnvironment(projectId, envId, user.userId);
  }

  @Post(':projectId/:envId/reset-key')
  @HttpCode(200)
  async resetKey(
    @Param('projectId') projectId: string,
    @Param('envId') envId: string,
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;
    return this.environmentService.resetSdkKey(projectId, envId, user.userId);
  }
}
