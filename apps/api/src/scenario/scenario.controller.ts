import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ScenarioService } from './scenario.service';
import { CreateScenarioDto } from './dto/create-scenario.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthUser } from '../auth/jwt.strategy';

@Controller('scenario')
export class ScenarioController {
  constructor(private readonly scenarioService: ScenarioService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() dto: CreateScenarioDto, @Req() req: Request) {
    const user = req.user as AuthUser;
    return this.scenarioService.create(user.userId, dto);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.scenarioService.findById(id);
  }

  @Get(':id/simulations')
  async getSimulations(@Param('id') id: string) {
    return this.scenarioService.getSimulations(id);
  }
}
