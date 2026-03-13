import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { FeedbackService } from './feedback.service';
import type { FeedbackRecord, FeedbackSummary } from './feedback.service';
import { SubmitFeedbackDto } from './dto/submit-feedback.dto';
import { QueryFeedbackDto } from './dto/query-feedback.dto';
import type { AuthUser } from '../auth/jwt.strategy';

@Controller('v1/security/feedback')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  // -- Dashboard routes (JWT auth) --

  @Post(':projectId/:eventId')
  @UseGuards(JwtAuthGuard)
  async submit(
    @Param('projectId') projectId: string,
    @Param('eventId') eventId: string,
    @Body() dto: SubmitFeedbackDto,
    @Req() req: Request,
  ): Promise<FeedbackRecord> {
    const user = req.user as AuthUser;
    return this.feedbackService.submit(projectId, eventId, user.userId, dto);
  }

  @Get(':projectId/event/:eventId')
  @UseGuards(JwtAuthGuard)
  async getForEvent(
    @Param('projectId') projectId: string,
    @Param('eventId') eventId: string,
    @Req() req: Request,
  ): Promise<FeedbackRecord[]> {
    const user = req.user as AuthUser;
    return this.feedbackService.getForEvent(projectId, eventId, user.userId);
  }

  @Get(':projectId')
  @UseGuards(JwtAuthGuard)
  async query(
    @Param('projectId') projectId: string,
    @Query() dto: QueryFeedbackDto,
    @Req() req: Request,
  ): Promise<{ items: FeedbackRecord[]; total: number; page: number; limit: number }> {
    const user = req.user as AuthUser;
    return this.feedbackService.query(projectId, user.userId, dto);
  }

  @Get(':projectId/summary')
  @UseGuards(JwtAuthGuard)
  async summary(
    @Param('projectId') projectId: string,
    @Req() req: Request,
  ): Promise<FeedbackSummary> {
    const user = req.user as AuthUser;
    return this.feedbackService.summary(projectId, user.userId);
  }

  // -- SDK route (API key auth) --

  @Post('report')
  @UseGuards(ApiKeyGuard)
  @HttpCode(202)
  async submitFromSdk(
    @Body() body: SubmitFeedbackDto & { eventId: string },
    @Req() req: Request,
  ): Promise<{ accepted: boolean }> {
    const projectId = (req as Request & { projectId: string }).projectId;
    const { eventId, ...dto } = body;
    await this.feedbackService.submitFromSdk(projectId, eventId, dto);
    return { accepted: true };
  }
}
