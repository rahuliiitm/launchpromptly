import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { ProjectService } from './project.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ProjectService', () => {
  let service: ProjectService;
  let prisma: PrismaService;

  const mockProject = {
    id: 'project-123',
    organizationId: 'org-123',
    name: 'Default Project',
    createdAt: new Date(),
  };

  const mockApiKey = {
    id: 'key-123',
    projectId: 'project-123',
    keyPrefix: 'pf_live_abcdef',
    keyHash: 'hashed',
    name: 'Default',
    createdAt: new Date(),
    lastUsedAt: null,
    revokedAt: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn().mockResolvedValue({
                id: 'user-123',
                email: 'test@example.com',
                organizationId: 'org-123',
                organization: {
                  id: 'org-123',
                  projects: [mockProject],
                },
              }),
            },
            apiKey: {
              findMany: jest.fn().mockResolvedValue([mockApiKey]),
              findFirst: jest.fn().mockResolvedValue(mockApiKey),
              create: jest.fn().mockResolvedValue(mockApiKey),
              update: jest.fn().mockResolvedValue({ ...mockApiKey, revokedAt: new Date() }),
            },
          },
        },
      ],
    }).compile();

    service = module.get<ProjectService>(ProjectService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('listProjects', () => {
    it('should return projects from user organization', async () => {
      const result = await service.listProjects('user-123');
      expect(result).toEqual([mockProject]);
    });

    it('should return empty array if user has no organization', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-123',
        organization: null,
      });
      const result = await service.listProjects('user-123');
      expect(result).toEqual([]);
    });
  });

  describe('assertProjectAccess', () => {
    it('should not throw for authorized user', async () => {
      await expect(
        service.assertProjectAccess('project-123', 'user-123'),
      ).resolves.toBeUndefined();
    });

    it('should throw ForbiddenException for unauthorized user', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-999',
        organization: { id: 'org-999', projects: [] },
      });
      await expect(
        service.assertProjectAccess('project-123', 'user-999'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('generateApiKey', () => {
    it('should create an API key and return raw key', async () => {
      const result = await service.generateApiKey('project-123', 'user-123', 'Test Key');
      expect(result.rawKey).toMatch(/^pf_live_[a-f0-9]{64}$/);
      expect(result.apiKey.id).toBe('key-123');
      expect(prisma.apiKey.create).toHaveBeenCalled();
    });
  });

  describe('revokeApiKey', () => {
    it('should revoke an existing API key', async () => {
      await service.revokeApiKey('project-123', 'key-123', 'user-123');
      expect(prisma.apiKey.update).toHaveBeenCalledWith({
        where: { id: 'key-123' },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('should throw NotFoundException for non-existent key', async () => {
      (prisma.apiKey.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(
        service.revokeApiKey('project-123', 'key-999', 'user-123'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('listApiKeys', () => {
    it('should return API keys for the project', async () => {
      const result = await service.listApiKeys('project-123', 'user-123');
      expect(result).toEqual([mockApiKey]);
    });
  });
});
