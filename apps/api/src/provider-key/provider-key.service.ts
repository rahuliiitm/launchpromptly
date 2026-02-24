import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../crypto/crypto.service';
import type { LLMProvider } from '@aiecon/types';

export interface ProviderKeyInfo {
  id: string;
  organizationId: string;
  provider: string;
  label: string;
  createdAt: Date;
}

@Injectable()
export class ProviderKeyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  async setKey(
    organizationId: string,
    provider: LLMProvider,
    rawKey: string,
    label?: string,
  ): Promise<ProviderKeyInfo> {
    const { encrypted, iv, authTag } = this.crypto.encrypt(rawKey);
    const result = await this.prisma.orgProviderKey.upsert({
      where: { organizationId_provider: { organizationId, provider } },
      create: {
        organizationId,
        provider,
        encryptedKey: encrypted,
        iv,
        authTag,
        label: label ?? 'Default',
      },
      update: {
        encryptedKey: encrypted,
        iv,
        authTag,
        ...(label !== undefined && { label }),
      },
    });
    return {
      id: result.id,
      organizationId: result.organizationId,
      provider: result.provider,
      label: result.label,
      createdAt: result.createdAt,
    };
  }

  async deleteKey(organizationId: string, provider: LLMProvider): Promise<void> {
    const existing = await this.prisma.orgProviderKey.findUnique({
      where: { organizationId_provider: { organizationId, provider } },
    });
    if (!existing) throw new NotFoundException('Provider key not found');
    await this.prisma.orgProviderKey.delete({
      where: { id: existing.id },
    });
  }

  async listKeys(organizationId: string): Promise<ProviderKeyInfo[]> {
    return this.prisma.orgProviderKey.findMany({
      where: { organizationId },
      select: {
        id: true,
        organizationId: true,
        provider: true,
        label: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getDecryptedKey(
    organizationId: string,
    provider: LLMProvider,
  ): Promise<string | null> {
    const record = await this.prisma.orgProviderKey.findUnique({
      where: { organizationId_provider: { organizationId, provider } },
    });
    if (!record) return null;
    return this.crypto.decrypt(record.encryptedKey, record.iv, record.authTag);
  }
}
