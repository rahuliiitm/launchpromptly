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
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              upsert: jest.fn().mockResolvedValue(mockUser),
              findUnique: jest.fn().mockResolvedValue(mockUser),
            },
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
    it('should create user and return JWT', async () => {
      const result = await service.register('test@example.com');

      expect(result.accessToken).toBe('mock-jwt-token');
      expect(result.userId).toBe('user-123');
      expect(prisma.user.upsert).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
        update: {},
        create: { email: 'test@example.com' },
      });
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: 'user-123',
        email: 'test@example.com',
      });
    });
  });

  describe('login', () => {
    it('should return JWT for existing user', async () => {
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
