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
    const user = await this.prisma.user.upsert({
      where: { email },
      update: {},
      create: { email },
    });

    const accessToken = this.jwtService.sign({ sub: user.id, email: user.email });

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
