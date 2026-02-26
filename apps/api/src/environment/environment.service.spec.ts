import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { EnvironmentService } from './environment.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectService } from '../project/project.service';

jest.mock('bcrypt');

describe('EnvironmentService', () => {
  let service: EnvironmentService;
  let prisma: PrismaService;
  let projectService: ProjectService;

  const mockEnv = {
    id: 'env-1',
    projectId: 'proj-1',
    name: 'Production',
    slug: 'production',
    color: '#059669',
    sortOrder: 0,
    isCritical: true,
    createdAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (bcrypt.hash as jest.Mock).mockResolvedValue('$2b$10$hashed');

    prisma = {
      environment: {
        create: jest.fn().mockResolvedValue(mockEnv),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(mockEnv),
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue(mockEnv),
        delete: jest.fn().mockResolvedValue(mockEnv),
        count: jest.fn().mockResolvedValue(2),
        aggregate: jest.fn().mockResolvedValue({ _max: { sortOrder: 1 } }),
      },
      apiKey: {
        create: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      promptDeployment: {
        count: jest.fn().mockResolvedValue(0),
      },
    } as unknown as PrismaService;

    projectService = {
      assertProjectAccess: jest.fn().mockResolvedValue(undefined),
    } as unknown as ProjectService;

    service = new EnvironmentService(prisma, projectService);
  });

  describe('createDefaultEnvironments', () => {
    it('should create Production and Development environments with SDK keys', async () => {
      await service.createDefaultEnvironments('proj-1');

      expect(prisma.environment.create).toHaveBeenCalledTimes(2);
      expect(prisma.environment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          projectId: 'proj-1',
          name: 'Production',
          slug: 'production',
          isCritical: true,
        }),
      });
      expect(prisma.environment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          projectId: 'proj-1',
          name: 'Development',
          slug: 'development',
          isCritical: false,
        }),
      });
      // Each env gets an SDK key
      expect(prisma.apiKey.create).toHaveBeenCalledTimes(2);
    });

    it('should generate keys with lp_live_ prefix', async () => {
      await service.createDefaultEnvironments('proj-1');

      const calls = (prisma.apiKey.create as jest.Mock).mock.calls;
      for (const call of calls) {
        expect(call[0].data.keyPrefix).toMatch(/^lp_live_/);
        expect(call[0].data.environmentId).toBe('env-1');
      }
    });
  });

  describe('listEnvironments', () => {
    it('should return environments sorted by sortOrder with SDK key prefix', async () => {
      (prisma.environment.findMany as jest.Mock).mockResolvedValue([
        { ...mockEnv, apiKeys: [{ keyPrefix: 'lp_live_abcdef' }] },
      ]);

      const result = await service.listEnvironments('proj-1', 'user-1');

      expect(projectService.assertProjectAccess).toHaveBeenCalledWith('proj-1', 'user-1');
      expect(result).toHaveLength(1);
      expect(result[0].sdkKeyPrefix).toBe('lp_live_abcdef');
    });
  });

  describe('createEnvironment', () => {
    it('should create environment with auto-generated SDK key', async () => {
      const result = await service.createEnvironment('proj-1', 'user-1', {
        name: 'Staging',
        slug: 'staging',
        color: '#F59E0B',
      });

      expect(result.name).toBe('Production'); // returns from mock
      expect(result.sdkKey).toBeDefined();
      expect(result.sdkKey).toMatch(/^lp_live_/);
      expect(prisma.apiKey.create).toHaveBeenCalled();
    });

    it('should throw ConflictException for duplicate slug', async () => {
      (prisma.environment.findUnique as jest.Mock).mockResolvedValue(mockEnv);

      await expect(
        service.createEnvironment('proj-1', 'user-1', {
          name: 'Staging',
          slug: 'production',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('updateEnvironment', () => {
    it('should update name, color, isCritical', async () => {
      await service.updateEnvironment('proj-1', 'env-1', 'user-1', {
        name: 'Prod US-East',
        color: '#EF4444',
        isCritical: true,
      });

      expect(prisma.environment.update).toHaveBeenCalledWith({
        where: { id: 'env-1' },
        data: expect.objectContaining({
          name: 'Prod US-East',
          color: '#EF4444',
          isCritical: true,
        }),
      });
    });

    it('should throw NotFoundException for missing environment', async () => {
      (prisma.environment.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.updateEnvironment('proj-1', 'env-missing', 'user-1', { name: 'New' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteEnvironment', () => {
    it('should delete environment and revoke API keys', async () => {
      await service.deleteEnvironment('proj-1', 'env-1', 'user-1');

      expect(prisma.apiKey.updateMany).toHaveBeenCalledWith({
        where: { environmentId: 'env-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(prisma.environment.delete).toHaveBeenCalledWith({
        where: { id: 'env-1' },
      });
    });

    it('should throw BadRequestException if deployments exist', async () => {
      (prisma.promptDeployment.count as jest.Mock).mockResolvedValue(3);

      await expect(
        service.deleteEnvironment('proj-1', 'env-1', 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if last environment', async () => {
      (prisma.environment.count as jest.Mock).mockResolvedValue(1);

      await expect(
        service.deleteEnvironment('proj-1', 'env-1', 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('resetSdkKey', () => {
    it('should revoke old keys and generate new one', async () => {
      const result = await service.resetSdkKey('proj-1', 'env-1', 'user-1');

      expect(prisma.apiKey.updateMany).toHaveBeenCalledWith({
        where: { environmentId: 'env-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(result.sdkKey).toMatch(/^lp_live_/);
      expect(result.sdkKeyPrefix).toMatch(/^lp_live_/);
      expect(prisma.apiKey.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException for missing environment', async () => {
      (prisma.environment.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.resetSdkKey('proj-1', 'env-missing', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
