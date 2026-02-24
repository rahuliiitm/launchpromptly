import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { AuthUser } from '../auth/jwt.strategy';
import { InvitationService } from './invitation.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';

@Controller('invitations')
export class InvitationController {
  constructor(private readonly invitationService: InvitationService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async create(@Body() dto: CreateInvitationDto, @Req() req: Request) {
    const user = req.user as AuthUser;
    return this.invitationService.createInvitation(
      user.organizationId!,
      user.userId,
      dto.email,
      dto.role,
    );
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async list(@Req() req: Request) {
    const user = req.user as AuthUser;
    return this.invitationService.listInvitations(user.organizationId!);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async revoke(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as AuthUser;
    return this.invitationService.revokeInvitation(user.organizationId!, id);
  }

  @Get('token/:token')
  async getByToken(@Param('token') token: string) {
    return this.invitationService.getInvitationByToken(token);
  }

  @Post('accept')
  async accept(@Body() dto: AcceptInvitationDto) {
    return this.invitationService.acceptInvitation(dto.token, dto.password);
  }

  @Get('team')
  @UseGuards(JwtAuthGuard)
  async listTeam(@Req() req: Request) {
    const user = req.user as AuthUser;
    return this.invitationService.listTeamMembers(user.organizationId!);
  }

  @Delete('team/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async removeMember(@Param('userId') targetUserId: string, @Req() req: Request) {
    const user = req.user as AuthUser;
    return this.invitationService.removeMember(user.organizationId!, user.userId, targetUserId);
  }
}
