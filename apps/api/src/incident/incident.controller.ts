import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IncidentService } from './incident.service';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { UpdateIncidentDto } from './dto/update-incident.dto';
import { QueryIncidentDto } from './dto/query-incident.dto';
import type { AuthUser } from '../auth/jwt.strategy';

@Controller('v1/security/incidents')
@UseGuards(JwtAuthGuard)
export class IncidentController {
  constructor(private readonly incidentService: IncidentService) {}

  @Post(':projectId')
  async create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateIncidentDto,
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;
    return this.incidentService.create(projectId, user.userId, dto);
  }

  @Get(':projectId')
  async findAll(
    @Param('projectId') projectId: string,
    @Query() query: QueryIncidentDto,
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;
    return this.incidentService.findAll(projectId, user.userId, query);
  }

  @Get(':projectId/summary')
  async summary(
    @Param('projectId') projectId: string,
    @Query('days') days: string,
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;
    const parsedDays = days ? parseInt(days, 10) : undefined;
    return this.incidentService.getSummary(projectId, user.userId, parsedDays);
  }

  @Get(':projectId/:incidentId')
  async findOne(
    @Param('projectId') projectId: string,
    @Param('incidentId') incidentId: string,
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;
    return this.incidentService.findOne(projectId, user.userId, incidentId);
  }

  @Patch(':projectId/:incidentId')
  async update(
    @Param('projectId') projectId: string,
    @Param('incidentId') incidentId: string,
    @Body() dto: UpdateIncidentDto,
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;
    return this.incidentService.update(
      projectId,
      user.userId,
      incidentId,
      dto,
    );
  }

  @Delete(':projectId/:incidentId')
  async remove(
    @Param('projectId') projectId: string,
    @Param('incidentId') incidentId: string,
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;
    return this.incidentService.remove(projectId, user.userId, incidentId);
  }
}
