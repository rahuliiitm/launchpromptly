import {
  Controller,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { ProviderKeyService } from './provider-key.service';
import { SetProviderKeyDto } from './dto/set-provider-key.dto';
import type { Request } from 'express';
import type { LLMProvider } from '@aiecon/types';

interface AuthUser {
  userId: string;
  email: string;
}

@Controller('provider-keys')
@UseGuards(JwtAuthGuard)
export class ProviderKeyController {
  constructor(
    private readonly providerKeyService: ProviderKeyService,
    private readonly prisma: PrismaService,
  ) {}

  private async getOrgId(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.organizationId) {
      throw new ForbiddenException('User is not part of an organization');
    }
    return user.organizationId;
  }

  @Get()
  async list(@Req() req: Request) {
    const user = req.user as AuthUser;
    const orgId = await this.getOrgId(user.userId);
    return this.providerKeyService.listKeys(orgId);
  }

  @Put(':provider')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async set(
    @Param('provider') provider: LLMProvider,
    @Body() dto: SetProviderKeyDto,
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;
    const orgId = await this.getOrgId(user.userId);
    return this.providerKeyService.setKey(orgId, provider, dto.key, dto.label);
  }

  @Delete(':provider')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async remove(
    @Param('provider') provider: LLMProvider,
    @Req() req: Request,
  ) {
    const user = req.user as AuthUser;
    const orgId = await this.getOrgId(user.userId);
    await this.providerKeyService.deleteKey(orgId, provider);
    return { deleted: true };
  }
}
