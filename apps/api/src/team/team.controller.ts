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
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TeamService } from './team.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { AddTeamMemberDto } from './dto/add-team-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import type { Request } from 'express';

@Controller('team')
@UseGuards(JwtAuthGuard)
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @Post(':projectId')
  async create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateTeamDto,
    @Req() req: Request,
  ) {
    return this.teamService.createTeam(projectId, (req as any).user.userId, dto);
  }

  @Get(':projectId')
  async list(
    @Param('projectId') projectId: string,
    @Req() req: Request,
  ) {
    return this.teamService.listTeams(projectId, (req as any).user.userId);
  }

  @Get(':projectId/:teamId')
  async get(
    @Param('projectId') projectId: string,
    @Param('teamId') teamId: string,
    @Req() req: Request,
  ) {
    return this.teamService.getTeam(projectId, teamId, (req as any).user.userId);
  }

  @Patch(':projectId/:teamId')
  async update(
    @Param('projectId') projectId: string,
    @Param('teamId') teamId: string,
    @Body() dto: UpdateTeamDto,
    @Req() req: Request,
  ) {
    return this.teamService.updateTeam(projectId, teamId, (req as any).user.userId, dto);
  }

  @Delete(':projectId/:teamId')
  async remove(
    @Param('projectId') projectId: string,
    @Param('teamId') teamId: string,
    @Req() req: Request,
  ) {
    return this.teamService.deleteTeam(projectId, teamId, (req as any).user.userId);
  }

  // ── Members ──

  @Post(':projectId/:teamId/members')
  async addMember(
    @Param('projectId') projectId: string,
    @Param('teamId') teamId: string,
    @Body() dto: AddTeamMemberDto,
    @Req() req: Request,
  ) {
    return this.teamService.addMember(projectId, teamId, (req as any).user.userId, dto);
  }

  @Delete(':projectId/:teamId/members/:targetUserId')
  async removeMember(
    @Param('projectId') projectId: string,
    @Param('teamId') teamId: string,
    @Param('targetUserId') targetUserId: string,
    @Req() req: Request,
  ) {
    return this.teamService.removeMember(
      projectId, teamId, (req as any).user.userId, targetUserId,
    );
  }

  @Patch(':projectId/:teamId/members/:targetUserId')
  async updateRole(
    @Param('projectId') projectId: string,
    @Param('teamId') teamId: string,
    @Param('targetUserId') targetUserId: string,
    @Body() dto: UpdateMemberRoleDto,
    @Req() req: Request,
  ) {
    return this.teamService.updateMemberRole(
      projectId, teamId, (req as any).user.userId, targetUserId, dto.role,
    );
  }
}
