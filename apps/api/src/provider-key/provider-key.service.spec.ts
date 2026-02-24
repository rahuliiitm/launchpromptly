import { NotFoundException } from '@nestjs/common';
import { ProviderKeyService } from './provider-key.service';
import { CryptoService } from '../crypto/crypto.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ProviderKeyService', () => {
  let service: ProviderKeyService;
  let prisma: jest.Mocked<PrismaService>;
  let crypto: jest.Mocked<CryptoService>;

  beforeEach(() => {
    prisma = {
      orgProviderKey: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        delete: jest.fn(),
      },
    } as unknown as jest.Mocked<PrismaService>;

    crypto = {
      encrypt: jest.fn().mockReturnValue({
        encrypted: 'enc',
        iv: 'iv123',
        authTag: 'tag456',
      }),
      decrypt: jest.fn().mockReturnValue('decrypted-key'),
    } as unknown as jest.Mocked<CryptoService>;

    service = new ProviderKeyService(prisma, crypto);
  });

  describe('setKey', () => {
    it('encrypts and upserts the key', async () => {
      const record = {
        id: 'key-1',
        organizationId: 'org-1',
        provider: 'openai',
        label: 'My Key',
        createdAt: new Date(),
      };
      (prisma.orgProviderKey.upsert as jest.Mock).mockResolvedValue(record);

      const result = await service.setKey('org-1', 'openai', 'sk-raw-key', 'My Key');

      expect(crypto.encrypt).toHaveBeenCalledWith('sk-raw-key');
      expect(prisma.orgProviderKey.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId_provider: { organizationId: 'org-1', provider: 'openai' } },
          create: expect.objectContaining({ encryptedKey: 'enc', iv: 'iv123', authTag: 'tag456' }),
        }),
      );
      expect(result.id).toBe('key-1');
      expect(result.provider).toBe('openai');
    });
  });

  describe('deleteKey', () => {
    it('deletes an existing key', async () => {
      (prisma.orgProviderKey.findUnique as jest.Mock).mockResolvedValue({ id: 'key-1' });
      (prisma.orgProviderKey.delete as jest.Mock).mockResolvedValue({});

      await service.deleteKey('org-1', 'openai');

      expect(prisma.orgProviderKey.delete).toHaveBeenCalledWith({ where: { id: 'key-1' } });
    });

    it('throws if key not found', async () => {
      (prisma.orgProviderKey.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.deleteKey('org-1', 'openai')).rejects.toThrow(NotFoundException);
    });
  });

  describe('listKeys', () => {
    it('returns keys without encrypted data', async () => {
      const keys = [
        { id: 'k1', organizationId: 'org-1', provider: 'openai', label: 'Default', createdAt: new Date() },
      ];
      (prisma.orgProviderKey.findMany as jest.Mock).mockResolvedValue(keys);

      const result = await service.listKeys('org-1');
      expect(result).toEqual(keys);
    });
  });

  describe('getDecryptedKey', () => {
    it('decrypts and returns the key', async () => {
      (prisma.orgProviderKey.findUnique as jest.Mock).mockResolvedValue({
        encryptedKey: 'enc',
        iv: 'iv123',
        authTag: 'tag456',
      });

      const result = await service.getDecryptedKey('org-1', 'openai');
      expect(crypto.decrypt).toHaveBeenCalledWith('enc', 'iv123', 'tag456');
      expect(result).toBe('decrypted-key');
    });

    it('returns null if no key found', async () => {
      (prisma.orgProviderKey.findUnique as jest.Mock).mockResolvedValue(null);
      const result = await service.getDecryptedKey('org-1', 'anthropic');
      expect(result).toBeNull();
    });
  });
});
