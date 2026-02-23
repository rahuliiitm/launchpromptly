import { Controller, Post, Body, Req, UseGuards, HttpCode } from '@nestjs/common';
import type { Request } from 'express';
import { EventsService } from './events.service';
import { IngestBatchDto } from './dto/ingest-batch.dto';
import { ApiKeyGuard } from '../auth/api-key.guard';

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
    return this.eventsService.ingestBatch(projectId, dto);
  }
}
