import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EnvironmentService } from '../environment/environment.service';
import { EmailService } from '../email/email.service';

export interface AuthResponse {
  accessToken: string;
  userId: string;
  plan: string;
}

export interface UserProfile {
  id: string;
  email: string;
  organizationId: string | null;
  plan: string;
  projectId: string | null;
  role: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly environmentService: EnvironmentService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
  ) {}

  async register(email: string, password: string, name?: string): Promise<AuthResponse> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      include: { organization: true },
    });

    if (existingUser) {
      if (existingUser.passwordHash) {
        throw new ConflictException('Email already registered. Please log in.');
      }

      // Existing passwordless user — set their password (migration path)
      const passwordHash = await bcrypt.hash(password, 10);
      await this.prisma.user.update({
        where: { id: existingUser.id },
        data: { passwordHash },
      });

      const plan = existingUser.organization?.plan ?? 'free';
      const accessToken = this.jwtService.sign({
        sub: existingUser.id,
        email: existingUser.email,
        organizationId: existingUser.organizationId,
        plan,
        role: existingUser.role ?? 'member',
      });
      return { accessToken, userId: existingUser.id, plan };
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: { name: name ? `${name}'s Organization` : `${email}'s Organization` },
      });
      const created = await tx.user.create({
        data: { email, passwordHash, organizationId: org.id },
      });
      const project = await tx.project.create({
        data: { organizationId: org.id, name: 'Default Project' },
      });
      return { ...created, organization: org, projectId: project.id };
    });

    // Create default environments (Production + Development) with SDK keys
    await this.environmentService.createDefaultEnvironments(user.projectId);

    const plan = user.organization.plan;
    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      organizationId: user.organizationId,
      plan,
      role: 'admin',
    });
    return { accessToken, userId: user.id, plan };
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { organization: true },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const plan = user.organization?.plan ?? 'free';
    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      organizationId: user.organizationId,
      plan,
      role: user.role ?? 'member',
    });
    return { accessToken, userId: user.id, plan };
  }

  async getProfile(userId: string): Promise<UserProfile> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        organization: {
          include: { projects: { take: 1 } },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    return {
      id: user.id,
      email: user.email,
      organizationId: user.organizationId,
      plan: user.organization?.plan ?? 'free',
      projectId: user.organization?.projects[0]?.id ?? null,
      role: user.role ?? 'member',
    };
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    // Always return success to prevent email enumeration
    if (!user) {
      return { message: 'If that email exists, a reset link has been sent.' };
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: hashedToken,
        passwordResetExpires: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });

    await this.emailService.sendPasswordReset(email, rawToken);

    return { message: 'If that email exists, a reset link has been sent.' };
  }

  async resetPassword(rawToken: string, newPassword: string): Promise<{ message: string }> {
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetToken: hashedToken,
        passwordResetExpires: { gt: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token.');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });

    this.logger.log(`Password reset completed for user ${user.id}`);
    return { message: 'Password has been reset successfully.' };
  }
}
