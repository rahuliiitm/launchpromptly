import { Injectable, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';

export interface AuthResponse {
  accessToken: string;
  userId: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(email: string): Promise<AuthResponse> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      const accessToken = this.jwtService.sign({
        sub: existingUser.id,
        email: existingUser.email,
      });
      return { accessToken, userId: existingUser.id };
    }

    const user = await this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: { name: `${email}'s Organization` },
      });
      const created = await tx.user.create({
        data: { email, organizationId: org.id },
      });
      await tx.project.create({
        data: { organizationId: org.id, name: 'Default Project' },
      });
      return created;
    });

    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
    });
    return { accessToken, userId: user.id };
  }

  async login(email: string): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      throw new NotFoundException('User not found. Please register first.');
    }

    const accessToken = this.jwtService.sign({ sub: user.id, email: user.email });

    return { accessToken, userId: user.id };
  }
}
