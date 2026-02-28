import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RetentionService } from './retention.service';
import type { AuthUser } from '../auth/jwt.strategy';

@Controller('v1/compliance/retention')
@UseGuards(JwtAuthGuard)
export class RetentionController {
  constructor(private readonly retentionService: RetentionService) {}

  @Get(':projectId')
  async getRetentionConfig(
    @Param('projectId') projectId: string,
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;
    return this.retentionService.getRetentionConfig(projectId, user.userId);
  }

  @Patch(':projectId')
  async updateRetentionConfig(
    @Param('projectId') projectId: string,
    @Body() body: { retentionDays: number },
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;
    return this.retentionService.updateRetentionConfig(
      projectId,
      user.userId,
      body.retentionDays,
    );
  }

  @Post(':projectId/enforce')
  async enforceRetention(
    @Param('projectId') projectId: string,
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;
    // Verify the user has access to the project before enforcing
    await this.retentionService.getRetentionConfig(projectId, user.userId);
    return this.retentionService.enforceRetentionForProject(projectId);
  }
}
