import { Controller, Get, Post, Body, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlaygroundService } from './playground.service';
import { PlaygroundRequestDto } from './dto/playground-request.dto';
import type { Request } from 'express';

interface AuthUser {
  userId: string;
  email: string;
}

@Controller('playground')
@UseGuards(JwtAuthGuard)
export class PlaygroundController {
  constructor(private readonly playgroundService: PlaygroundService) {}

  @Post('test')
  async test(@Body() dto: PlaygroundRequestDto, @Req() req: Request) {
    const user = req.user as AuthUser;
    return this.playgroundService.testPrompt(
      user.userId,
      dto.systemPrompt,
      dto.userMessage,
      dto.models,
    );
  }

  @Get('models')
  async models(@Req() req: Request) {
    const user = req.user as AuthUser;
    return this.playgroundService.getAvailableModels(user.userId);
  }
}
