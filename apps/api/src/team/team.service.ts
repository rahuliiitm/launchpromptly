import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectService } from '../project/project.service';
import type { CreateTeamDto } from './dto/create-team.dto';
import type { UpdateTeamDto } from './dto/update-team.dto';
import type { AddTeamMemberDto } from './dto/add-team-member.dto';

const ROLE_RANK: Record<string, number> = { viewer: 0, editor: 1, lead: 2 };

export type TeamRole = 'viewer' | 'editor' | 'lead';

@Injectable()
export class TeamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectService: ProjectService,
  ) {}

  // ── Access Control Helpers ──

  async assertTeamRole(teamId: string, userId: string, minRole: TeamRole): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user?.role === 'admin') return; // Org administrator bypass

    const member = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });
    if (!member) throw new ForbiddenException('Not a member of this team');
    if (ROLE_RANK[member.role] < ROLE_RANK[minRole]) {
      throw new ForbiddenException(`Requires ${minRole} role in this team`);
    }
  }

  async assertPromptTeamAccess(promptId: string, userId: string, minRole: TeamRole): Promise<void> {
    const prompt = await this.prisma.managedPrompt.findUnique({
      where: { id: promptId },
      select: { teamId: true },
    });
    if (!prompt) throw new NotFoundException('Prompt not found');

    // Unassigned prompts → accessible to all org members
    if (!prompt.teamId) return;

    await this.assertTeamRole(prompt.teamId, userId, minRole);
  }

  // ── CRUD ──

  async createTeam(projectId: string, userId: string, dto: CreateTeamDto) {
    await this.projectService.assertProjectAccess(projectId, userId);

    // Only org administrators can create teams
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user?.role !== 'admin') {
      throw new ForbiddenException('Only org administrators can create teams');
    }

    const slug = dto.slug ?? this.slugify(dto.name);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const team = await tx.team.create({
          data: {
            projectId,
            name: dto.name,
            slug,
            description: dto.description ?? '',
            color: dto.color ?? '#6B7280',
          },
        });

        // Add creator as lead
        await tx.teamMember.create({
          data: {
            teamId: team.id,
            userId,
            role: 'lead',
          },
        });

        return team;
      });
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2002'
      ) {
        throw new ConflictException(`Team slug "${slug}" already exists in this project`);
      }
      throw error;
    }
  }

  async listTeams(projectId: string, userId: string) {
    await this.projectService.assertProjectAccess(projectId, userId);

    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    const where = user?.role === 'admin'
      ? { projectId }
      : { projectId, members: { some: { userId } } };

    return this.prisma.team.findMany({
      where,
      include: {
        members: {
          include: { user: { select: { email: true } } },
          orderBy: { createdAt: 'asc' },
        },
        _count: { select: { prompts: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async getTeam(projectId: string, teamId: string, userId: string) {
    await this.projectService.assertProjectAccess(projectId, userId);

    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    const team = await this.prisma.team.findFirst({
      where: { id: teamId, projectId },
      include: {
        members: {
          include: { user: { select: { email: true } } },
          orderBy: { createdAt: 'asc' },
        },
        _count: { select: { prompts: true } },
      },
    });
    if (!team) throw new NotFoundException('Team not found');

    // Non-admin must be a member
    if (user?.role !== 'admin') {
      const isMember = team.members.some((m) => m.userId === userId);
      if (!isMember) throw new ForbiddenException('Not a member of this team');
    }

    return team;
  }

  async updateTeam(projectId: string, teamId: string, userId: string, dto: UpdateTeamDto) {
    await this.projectService.assertProjectAccess(projectId, userId);
    await this.assertTeamRole(teamId, userId, 'lead');

    const team = await this.prisma.team.findFirst({ where: { id: teamId, projectId } });
    if (!team) throw new NotFoundException('Team not found');

    return this.prisma.team.update({
      where: { id: teamId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.color !== undefined && { color: dto.color }),
      },
    });
  }

  async deleteTeam(projectId: string, teamId: string, userId: string) {
    await this.projectService.assertProjectAccess(projectId, userId);

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user?.role !== 'admin') {
      throw new ForbiddenException('Only org administrators can delete teams');
    }

    const team = await this.prisma.team.findFirst({ where: { id: teamId, projectId } });
    if (!team) throw new NotFoundException('Team not found');

    // Prompts get teamId = NULL via onDelete: SetNull
    await this.prisma.team.delete({ where: { id: teamId } });
    return { deleted: true };
  }

  // ── Member Management ──

  async addMember(projectId: string, teamId: string, userId: string, dto: AddTeamMemberDto) {
    await this.projectService.assertProjectAccess(projectId, userId);
    await this.assertTeamRole(teamId, userId, 'lead');

    const team = await this.prisma.team.findFirst({ where: { id: teamId, projectId } });
    if (!team) throw new NotFoundException('Team not found');

    // Verify target user exists and is in the same org
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    const targetUser = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!targetUser || targetUser.organizationId !== project?.organizationId) {
      throw new NotFoundException('User not found in this organization');
    }

    try {
      const member = await this.prisma.teamMember.create({
        data: {
          teamId,
          userId: dto.userId,
          role: dto.role ?? 'editor',
        },
        include: { user: { select: { email: true } } },
      });
      return member;
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2002'
      ) {
        throw new ConflictException('User is already a member of this team');
      }
      throw error;
    }
  }

  async removeMember(projectId: string, teamId: string, userId: string, targetUserId: string) {
    await this.projectService.assertProjectAccess(projectId, userId);
    await this.assertTeamRole(teamId, userId, 'lead');

    const member = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: targetUserId } },
    });
    if (!member) throw new NotFoundException('Member not found');

    // Cannot remove the last lead
    if (member.role === 'lead') {
      const leadCount = await this.prisma.teamMember.count({
        where: { teamId, role: 'lead' },
      });
      if (leadCount <= 1) {
        throw new BadRequestException('Cannot remove the last team lead');
      }
    }

    await this.prisma.teamMember.delete({ where: { id: member.id } });
    return { removed: true };
  }

  async updateMemberRole(
    projectId: string,
    teamId: string,
    userId: string,
    targetUserId: string,
    newRole: string,
  ) {
    await this.projectService.assertProjectAccess(projectId, userId);
    await this.assertTeamRole(teamId, userId, 'lead');

    const member = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: targetUserId } },
    });
    if (!member) throw new NotFoundException('Member not found');

    // Cannot demote the last lead
    if (member.role === 'lead' && newRole !== 'lead') {
      const leadCount = await this.prisma.teamMember.count({
        where: { teamId, role: 'lead' },
      });
      if (leadCount <= 1) {
        throw new BadRequestException('Cannot demote the last team lead');
      }
    }

    return this.prisma.teamMember.update({
      where: { id: member.id },
      data: { role: newRole },
      include: { user: { select: { email: true } } },
    });
  }

  // ── Helpers ──

  private slugify(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}

