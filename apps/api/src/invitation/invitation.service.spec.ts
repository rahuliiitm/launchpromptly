import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InvitationService } from './invitation.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('$2b$10$hashed'),
}));

describe('InvitationService', () => {
  let service: InvitationService;
  let prisma: any;
  let jwtService: JwtService;

  const mockOrg = {
    id: 'org-1',
    name: 'Test Org',
    plan: 'free',
    projects: [{ id: 'proj-1' }],
  };

  const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const pastDate = new Date(Date.now() - 1000);

  beforeEach(() => {
    prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        update: jest.fn(),
      },
      invitation: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    } as unknown as PrismaService;

    jwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt'),
    } as unknown as JwtService;

    const configService = {
      get: jest.fn().mockReturnValue('http://localhost:3000'),
    } as unknown as ConfigService;

    service = new InvitationService(prisma, jwtService, configService);
  });

  describe('createInvitation', () => {
    it('should create an invitation and return invite URL', async () => {
      const created = {
        id: 'inv-1',
        email: 'member@test.com',
        role: 'member',
        createdAt: new Date(),
        expiresAt: futureDate,
        acceptedAt: null,
      };
      prisma.invitation.upsert.mockResolvedValue(created);

      const result = await service.createInvitation('org-1', 'user-1', 'member@test.com');

      expect(result.invitation.email).toBe('member@test.com');
      expect(result.invitation.role).toBe('member');
      expect(result.inviteUrl).toContain('/invite/');
    });

    it('should reject if user is already a member', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'u1', email: 'member@test.com' });

      await expect(
        service.createInvitation('org-1', 'user-1', 'member@test.com'),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject if pending invitation exists', async () => {
      prisma.invitation.findUnique.mockResolvedValue({
        acceptedAt: null,
        expiresAt: futureDate,
      });

      await expect(
        service.createInvitation('org-1', 'user-1', 'member@test.com'),
      ).rejects.toThrow(ConflictException);
    });

    it('should allow re-invite for expired invitation', async () => {
      prisma.invitation.findUnique.mockResolvedValue({
        acceptedAt: null,
        expiresAt: pastDate,
      });
      prisma.invitation.upsert.mockResolvedValue({
        id: 'inv-1',
        email: 'member@test.com',
        role: 'member',
        createdAt: new Date(),
        expiresAt: futureDate,
        acceptedAt: null,
      });

      const result = await service.createInvitation('org-1', 'user-1', 'member@test.com');
      expect(result.invitation.email).toBe('member@test.com');
    });
  });

  describe('listInvitations', () => {
    it('should return invitations for org', async () => {
      prisma.invitation.findMany.mockResolvedValue([
        { id: 'inv-1', email: 'a@b.com', role: 'member', createdAt: new Date(), expiresAt: futureDate, acceptedAt: null },
      ]);

      const result = await service.listInvitations('org-1');
      expect(result).toHaveLength(1);
      expect(result[0].email).toBe('a@b.com');
    });
  });

  describe('revokeInvitation', () => {
    it('should delete a pending invitation', async () => {
      prisma.invitation.findFirst.mockResolvedValue({ id: 'inv-1', acceptedAt: null });
      prisma.invitation.delete.mockResolvedValue({});

      const result = await service.revokeInvitation('org-1', 'inv-1');
      expect(result.deleted).toBe(true);
    });

    it('should throw NotFoundException for missing invitation', async () => {
      prisma.invitation.findFirst.mockResolvedValue(null);

      await expect(service.revokeInvitation('org-1', 'bad-id')).rejects.toThrow(NotFoundException);
    });

    it('should reject revoking accepted invitation', async () => {
      prisma.invitation.findFirst.mockResolvedValue({ id: 'inv-1', acceptedAt: new Date() });

      await expect(service.revokeInvitation('org-1', 'inv-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('getInvitationByToken', () => {
    it('should return invitation info', async () => {
      prisma.invitation.findUnique.mockResolvedValue({
        email: 'a@b.com',
        acceptedAt: null,
        expiresAt: futureDate,
        organization: { name: 'Test Org' },
      });

      const result = await service.getInvitationByToken('some-token');
      expect(result.email).toBe('a@b.com');
      expect(result.orgName).toBe('Test Org');
      expect(result.expired).toBe(false);
    });

    it('should throw NotFoundException for invalid token', async () => {
      prisma.invitation.findUnique.mockResolvedValue(null);
      await expect(service.getInvitationByToken('bad')).rejects.toThrow(NotFoundException);
    });
  });

  describe('acceptInvitation', () => {
    it('should create user, accept invitation, and return JWT', async () => {
      prisma.invitation.findUnique.mockResolvedValue({
        id: 'inv-1',
        email: 'new@test.com',
        role: 'member',
        organizationId: 'org-1',
        acceptedAt: null,
        expiresAt: futureDate,
        organization: mockOrg,
      });
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'u-new',
        email: 'new@test.com',
        role: 'member',
        organizationId: 'org-1',
      });
      prisma.invitation.update.mockResolvedValue({});

      const result = await service.acceptInvitation('valid-token', 'password123');

      expect(result.accessToken).toBe('mock-jwt');
      expect(result.userId).toBe('u-new');
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'member' }),
      );
    });

    it('should reject already accepted invitation', async () => {
      prisma.invitation.findUnique.mockResolvedValue({
        acceptedAt: new Date(),
        expiresAt: futureDate,
        organization: mockOrg,
      });

      await expect(service.acceptInvitation('tok', 'pass1234')).rejects.toThrow(BadRequestException);
    });

    it('should reject expired invitation', async () => {
      prisma.invitation.findUnique.mockResolvedValue({
        acceptedAt: null,
        expiresAt: pastDate,
        organization: mockOrg,
      });

      await expect(service.acceptInvitation('tok', 'pass1234')).rejects.toThrow(BadRequestException);
    });

    it('should reject if user already belongs to an org', async () => {
      prisma.invitation.findUnique.mockResolvedValue({
        id: 'inv-1',
        email: 'existing@test.com',
        role: 'member',
        organizationId: 'org-1',
        acceptedAt: null,
        expiresAt: futureDate,
        organization: mockOrg,
      });
      prisma.user.findUnique.mockResolvedValue({
        id: 'u-existing',
        email: 'existing@test.com',
        organizationId: 'org-other',
      });

      await expect(service.acceptInvitation('tok', 'pass1234')).rejects.toThrow(ConflictException);
    });
  });

  describe('listTeamMembers', () => {
    it('should return team members', async () => {
      prisma.user.findMany.mockResolvedValue([
        { id: 'u1', email: 'admin@test.com', role: 'admin', createdAt: new Date() },
        { id: 'u2', email: 'member@test.com', role: 'member', createdAt: new Date() },
      ]);

      const result = await service.listTeamMembers('org-1');
      expect(result).toHaveLength(2);
    });
  });

  describe('removeMember', () => {
    it('should remove a team member', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'u2', organizationId: 'org-1' });
      prisma.user.update.mockResolvedValue({});

      const result = await service.removeMember('org-1', 'u1', 'u2');
      expect(result.removed).toBe(true);
    });

    it('should prevent self-removal', async () => {
      await expect(service.removeMember('org-1', 'u1', 'u1')).rejects.toThrow(BadRequestException);
    });

    it('should throw for non-existent member', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(service.removeMember('org-1', 'u1', 'u-bad')).rejects.toThrow(NotFoundException);
    });
  });
});
