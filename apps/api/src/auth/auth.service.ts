import {
  Injectable,
  NotFoundException,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(email: string, password: string): Promise<AuthResponse> {
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
        role: existingUser.role ?? 'admin',
      });
      return { accessToken, userId: existingUser.id, plan };
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: { name: `${email}'s Organization` },
      });
      const created = await tx.user.create({
        data: { email, passwordHash, organizationId: org.id },
      });
      await tx.project.create({
        data: { organizationId: org.id, name: 'Default Project' },
      });
      return { ...created, organization: org };
    });

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

    if (!user) {
      throw new NotFoundException('User not found. Please register first.');
    }

    if (!user.passwordHash) {
      throw new BadRequestException(
        'No password set. Please register with a password first.',
      );
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
      role: user.role ?? 'admin',
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
      role: user.role ?? 'admin',
    };
  }
}
