import { JwtService } from '@nestjs/jwt';
import {
  NotFoundException,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { EnvironmentService } from '../environment/environment.service';
import { EmailService } from '../email/email.service';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let environmentService: EnvironmentService;
  let emailService: EmailService;

  const mockOrg = {
    id: 'org-123',
    name: "test@example.com's Organization",
    plan: 'free',
    createdAt: new Date(),
  };

  const mockProject = {
    id: 'project-123',
    organizationId: 'org-123',
    name: 'Default Project',
    createdAt: new Date(),
  };

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    passwordHash: '$2b$10$hashedpassword',
    organizationId: 'org-123',
    role: 'admin',
    createdAt: new Date(),
    organization: mockOrg,
  };

  const mockUserNoPassword = {
    ...mockUser,
    passwordHash: null,
  };

  const mockTx = {
    organization: {
      create: jest.fn().mockResolvedValue(mockOrg),
    },
    user: {
      create: jest.fn().mockResolvedValue({ ...mockUser, organization: mockOrg }),
    },
    project: {
      create: jest.fn().mockResolvedValue(mockProject),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (bcrypt.hash as jest.Mock).mockResolvedValue('$2b$10$hashedpassword');
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    // Re-set mockTx implementations after clearAllMocks
    mockTx.organization.create.mockResolvedValue(mockOrg);
    mockTx.user.create.mockResolvedValue({ ...mockUser, organization: mockOrg });
    mockTx.project.create.mockResolvedValue(mockProject);

    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue(mockUser),
      },
      $transaction: jest.fn().mockImplementation(
        (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx),
      ),
    } as unknown as PrismaService;

    jwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
    } as unknown as JwtService;

    environmentService = {
      createDefaultEnvironments: jest.fn().mockResolvedValue(undefined),
    } as unknown as EnvironmentService;

    emailService = {
      sendPasswordReset: jest.fn().mockResolvedValue(undefined),
    } as unknown as EmailService;

    service = new AuthService(prisma, environmentService, jwtService, emailService);
  });

  describe('register', () => {
    it('should create org, user, and project for new email', async () => {
      const result = await service.register('test@example.com', 'password123');

      expect(result.accessToken).toBe('mock-jwt-token');
      expect(result.userId).toBe('user-123');
      expect(result.plan).toBe('free');
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
      expect(mockTx.user.create).toHaveBeenCalledWith({
        data: {
          email: 'test@example.com',
          passwordHash: '$2b$10$hashedpassword',
          organizationId: 'org-123',
        },
      });
    });

    it('should use name in org when provided', async () => {
      await service.register('test@example.com', 'password123', 'Alice');

      expect(mockTx.organization.create).toHaveBeenCalledWith({
        data: { name: "Alice's Organization" },
      });
    });

    it('should throw ConflictException for existing user with password', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      await expect(
        service.register('test@example.com', 'password123'),
      ).rejects.toThrow(ConflictException);
    });

    it('should set password for existing passwordless user', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUserNoPassword);

      const result = await service.register('test@example.com', 'password123');

      expect(result.accessToken).toBe('mock-jwt-token');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { passwordHash: '$2b$10$hashedpassword' },
      });
    });

    it('should sign JWT with plan and organizationId', async () => {
      await service.register('test@example.com', 'password123');

      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: 'user-123',
        email: 'test@example.com',
        organizationId: 'org-123',
        plan: 'free',
        role: 'admin',
      });
    });
  });

  describe('login', () => {
    it('should return JWT for valid credentials', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.login('test@example.com', 'password123');

      expect(result.accessToken).toBe('mock-jwt-token');
      expect(result.userId).toBe('user-123');
      expect(result.plan).toBe('free');
      expect(bcrypt.compare).toHaveBeenCalledWith('password123', '$2b$10$hashedpassword');
    });

    it('should throw NotFoundException for unknown email', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.login('unknown@example.com', 'password123'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for user without password', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUserNoPassword);

      await expect(
        service.login('test@example.com', 'password123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login('test@example.com', 'wrongpassword'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getProfile', () => {
    it('should return user profile with plan and projectId', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockUser,
        organization: {
          ...mockOrg,
          projects: [mockProject],
        },
      });

      const result = await service.getProfile('user-123');

      expect(result).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        organizationId: 'org-123',
        plan: 'free',
        projectId: 'project-123',
        role: 'admin',
      });
    });

    it('should throw NotFoundException for unknown user', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getProfile('unknown')).rejects.toThrow(NotFoundException);
    });
  });
});
