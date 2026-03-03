import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

export interface InvitationInfo {
  id: string;
  email: string;
  role: string;
  createdAt: Date;
  expiresAt: Date;
  acceptedAt: Date | null;
}

export interface TeamMember {
  id: string;
  email: string;
  role: string;
  createdAt: Date;
}

@Injectable()
export class InvitationService {
  private readonly appUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.appUrl = this.configService.get<string>('APP_URL', 'http://localhost:3000');
  }

  async createInvitation(
    organizationId: string,
    invitedById: string,
    email: string,
    role = 'member',
  ): Promise<{ invitation: InvitationInfo; inviteUrl: string }> {
    // Check if already a member
    const existingMember = await this.prisma.user.findFirst({
      where: { email, organizationId },
    });
    if (existingMember) {
      throw new ConflictException('User is already a member of this organization');
    }

    // Check for pending invitation
    const existing = await this.prisma.invitation.findUnique({
      where: { organizationId_email: { organizationId, email } },
    });
    if (existing && !existing.acceptedAt && existing.expiresAt > new Date()) {
      throw new ConflictException('An invitation is already pending for this email');
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invitation = await this.prisma.invitation.upsert({
      where: { organizationId_email: { organizationId, email } },
      create: { organizationId, email, role, token, invitedById, expiresAt },
      update: { role, token, invitedById, expiresAt, acceptedAt: null },
    });

    const inviteUrl = `${this.appUrl}/invite/${token}`;

    return {
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        createdAt: invitation.createdAt,
        expiresAt: invitation.expiresAt,
        acceptedAt: invitation.acceptedAt,
      },
      inviteUrl,
    };
  }

  async listInvitations(organizationId: string): Promise<InvitationInfo[]> {
    const invitations = await this.prisma.invitation.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });

    return invitations.map((inv) => ({
      id: inv.id,
      email: inv.email,
      role: inv.role,
      createdAt: inv.createdAt,
      expiresAt: inv.expiresAt,
      acceptedAt: inv.acceptedAt,
    }));
  }

  async revokeInvitation(organizationId: string, invitationId: string): Promise<{ deleted: true }> {
    const invitation = await this.prisma.invitation.findFirst({
      where: { id: invitationId, organizationId },
    });
    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }
    if (invitation.acceptedAt) {
      throw new BadRequestException('Cannot revoke an already accepted invitation');
    }
    await this.prisma.invitation.delete({ where: { id: invitationId } });
    return { deleted: true };
  }

  async getInvitationByToken(token: string): Promise<{ email: string; orgName: string; expired: boolean }> {
    const invitation = await this.prisma.invitation.findUnique({
      where: { token },
      include: { organization: true },
    });
    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }
    return {
      email: invitation.email,
      orgName: invitation.organization.name,
      expired: invitation.acceptedAt !== null || invitation.expiresAt < new Date(),
    };
  }

  async acceptInvitation(token: string, password: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { token },
      include: { organization: { include: { projects: { take: 1 } } } },
    });

    if (!invitation) throw new NotFoundException('Invitation not found');
    if (invitation.acceptedAt) throw new BadRequestException('Invitation already accepted');
    if (invitation.expiresAt < new Date()) throw new BadRequestException('Invitation has expired');

    const passwordHash = await bcrypt.hash(password, 10);

    const existingUser = await this.prisma.user.findUnique({
      where: { email: invitation.email },
    });

    let user;
    if (existingUser) {
      if (existingUser.organizationId) {
        throw new ConflictException('User already belongs to an organization');
      }
      user = await this.prisma.user.update({
        where: { id: existingUser.id },
        data: {
          organizationId: invitation.organizationId,
          role: invitation.role,
          passwordHash: existingUser.passwordHash ?? passwordHash,
        },
      });
    } else {
      user = await this.prisma.user.create({
        data: {
          email: invitation.email,
          passwordHash,
          organizationId: invitation.organizationId,
          role: invitation.role,
        },
      });
    }

    await this.prisma.invitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    });

    const plan = invitation.organization.plan;
    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      organizationId: invitation.organizationId,
      plan,
      role: user.role,
    });

    return { accessToken, userId: user.id, plan, role: user.role };
  }

  async listTeamMembers(organizationId: string): Promise<TeamMember[]> {
    return this.prisma.user.findMany({
      where: { organizationId },
      select: { id: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async removeMember(
    organizationId: string,
    requesterId: string,
    targetUserId: string,
  ): Promise<{ removed: true }> {
    if (requesterId === targetUserId) {
      throw new BadRequestException('Cannot remove yourself from the organization');
    }

    const target = await this.prisma.user.findFirst({
      where: { id: targetUserId, organizationId },
    });
    if (!target) {
      throw new NotFoundException('User not found in this organization');
    }

    await this.prisma.user.update({
      where: { id: targetUserId },
      data: { organizationId: null, role: 'member' },
    });

    return { removed: true };
  }
}
