import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { NotFoundException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let jwtService: JwtService;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    createdAt: new Date(),
    organizationId: 'org-123',
  };

  const mockOrg = {
    id: 'org-123',
    name: "test@example.com's Organization",
    createdAt: new Date(),
  };

  const mockProject = {
    id: 'project-123',
    organizationId: 'org-123',
    name: 'Default Project',
    createdAt: new Date(),
  };

  const mockTx = {
    organization: {
      create: jest.fn().mockResolvedValue(mockOrg),
    },
    user: {
      create: jest.fn().mockResolvedValue(mockUser),
    },
    project: {
      create: jest.fn().mockResolvedValue(mockProject),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn().mockResolvedValue(null),
            },
            $transaction: jest.fn().mockImplementation(
              (fn: (tx: typeof mockTx) => Promise<typeof mockUser>) => fn(mockTx),
            ),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock-jwt-token'),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
  });

  describe('register', () => {
    it('should create org, user, and project for new email', async () => {
      const result = await service.register('test@example.com');

      expect(result.accessToken).toBe('mock-jwt-token');
      expect(result.userId).toBe('user-123');
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(mockTx.organization.create).toHaveBeenCalledWith({
        data: { name: "test@example.com's Organization" },
      });
      expect(mockTx.user.create).toHaveBeenCalledWith({
        data: { email: 'test@example.com', organizationId: 'org-123' },
      });
      expect(mockTx.project.create).toHaveBeenCalledWith({
        data: { organizationId: 'org-123', name: 'Default Project' },
      });
    });

    it('should return token without creating org for existing user', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.register('test@example.com');

      expect(result.accessToken).toBe('mock-jwt-token');
      expect(result.userId).toBe('user-123');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should sign JWT with correct payload', async () => {
      await service.register('test@example.com');

      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: 'user-123',
        email: 'test@example.com',
      });
    });
  });

  describe('login', () => {
    it('should return JWT for existing user', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.login('test@example.com');

      expect(result.accessToken).toBe('mock-jwt-token');
      expect(result.userId).toBe('user-123');
    });

    it('should throw NotFoundException for unknown email', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.login('unknown@example.com')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
