import { Controller, Post, Get, Delete, Param, Body, Query, Req, UseGuards, HttpCode } from '@nestjs/common';
import type { Request } from 'express';
import { EventsService } from './events.service';
import { IngestBatchDto } from './dto/ingest-batch.dto';
import { DeleteEventsDto } from './dto/delete-events.dto';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthUser } from '../auth/jwt.strategy';

@Controller('v1/events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post('batch')
  @UseGuards(ApiKeyGuard)
  @HttpCode(202)
  async ingestBatch(
    @Body() dto: IngestBatchDto,
    @Req() req: Request,
  ): Promise<{ accepted: number }> {
    const projectId = (req as Request & { projectId: string }).projectId;
    const environmentId = (req as Request & { environmentId?: string }).environmentId;
    return this.eventsService.ingestBatch(projectId, dto, environmentId);
  }

  @Get(':projectId/:eventId')
  @UseGuards(JwtAuthGuard)
  async getEventDetail(
    @Param('projectId') projectId: string,
    @Param('eventId') eventId: string,
    @Req() req: Request,
  ): Promise<unknown> {
    const user = req.user as AuthUser;
    return this.eventsService.getEventDetail(projectId, eventId, user.userId);
  }

  @Delete(':projectId')
  @UseGuards(JwtAuthGuard)
  async deleteEvents(
    @Param('projectId') projectId: string,
    @Query() dto: DeleteEventsDto,
    @Req() req: Request,
  ): Promise<{ deletedCount: number }> {
    const user = req.user as AuthUser;
    return this.eventsService.deleteEvents(projectId, user.userId, dto);
  }
}
