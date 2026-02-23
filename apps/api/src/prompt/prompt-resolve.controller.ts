import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { PromptService } from './prompt.service';
import type { Request } from 'express';

@Controller('v1/prompts')
@UseGuards(ApiKeyGuard)
export class PromptResolveController {
  constructor(private readonly promptService: PromptService) {}

  @Get('resolve/:slug')
  async resolve(
    @Param('slug') slug: string,
    @Query('customerId') customerId: string | undefined,
    @Req() req: Request,
  ) {
    const projectId = (req as any).projectId as string;
    return this.promptService.resolvePrompt(projectId, slug, customerId);
  }
}
