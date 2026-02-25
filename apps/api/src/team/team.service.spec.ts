import {
  ForbiddenException,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { TeamService } from './team.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectService } from '../project/project.service';

describe('TeamService', () => {
  let service: TeamService;
  let prisma: any;
  let projectService: any;

  const mockTeam = {
    id: 'team-1',
    projectId: 'proj-1',
    name: 'ML Engineering',
    slug: 'ml-engineering',
    description: '',
    color: '#3B82F6',
    createdAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    prisma = {
      user: { findUnique: jest.fn() },
      team: {
        create: jest.fn().mockResolvedValue(mockTeam),
        findMany: jest.fn().mockResolvedValue([mockTeam]),
        findFirst: jest.fn().mockResolvedValue(mockTeam),
        update: jest.fn().mockResolvedValue(mockTeam),
        delete: jest.fn().mockResolvedValue(mockTeam),
      },
      teamMember: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        delete: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      project: { findUnique: jest.fn().mockResolvedValue({ id: 'proj-1', organizationId: 'org-1' }) },
      managedPrompt: { findUnique: jest.fn() },
      $transaction: jest.fn().mockImplementation((cb: any) => cb(prisma)),
    } as unknown as PrismaService;

    projectService = {
      assertProjectAccess: jest.fn().mockResolvedValue(undefined),
    } as unknown as ProjectService;

    service = new TeamService(prisma, projectService);
  });

  // ── assertTeamRole ──

  describe('assertTeamRole', () => {
    it('should pass for org admin regardless of team membership', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', role: 'admin' });

      await expect(service.assertTeamRole('team-1', 'u1', 'lead')).resolves.toBeUndefined();
      expect(prisma.teamMember.findUnique).not.toHaveBeenCalled();
    });

    it('should pass when member has sufficient role', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', role: 'member' });
      prisma.teamMember.findUnique.mockResolvedValue({ teamId: 'team-1', userId: 'u1', role: 'lead' });

      await expect(service.assertTeamRole('team-1', 'u1', 'editor')).resolves.toBeUndefined();
    });

    it('should throw ForbiddenException when member role is insufficient', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', role: 'member' });
      prisma.teamMember.findUnique.mockResolvedValue({ teamId: 'team-1', userId: 'u1', role: 'viewer' });

      await expect(service.assertTeamRole('team-1', 'u1', 'editor'))
        .rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when user is not a team member', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', role: 'member' });
      prisma.teamMember.findUnique.mockResolvedValue(null);

      await expect(service.assertTeamRole('team-1', 'u1', 'viewer'))
        .rejects.toThrow(ForbiddenException);
    });
  });

  // ── assertPromptTeamAccess ──

  describe('assertPromptTeamAccess', () => {
    it('should pass for unassigned prompts (teamId = null)', async () => {
      prisma.managedPrompt.findUnique.mockResolvedValue({ id: 'p1', teamId: null });

      await expect(service.assertPromptTeamAccess('p1', 'u1', 'viewer'))
        .resolves.toBeUndefined();
    });

    it('should check team role for assigned prompts', async () => {
      prisma.managedPrompt.findUnique.mockResolvedValue({ id: 'p1', teamId: 'team-1' });
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', role: 'member' });
      prisma.teamMember.findUnique.mockResolvedValue({ teamId: 'team-1', userId: 'u1', role: 'editor' });

      await expect(service.assertPromptTeamAccess('p1', 'u1', 'editor'))
        .resolves.toBeUndefined();
    });

    it('should throw NotFoundException for missing prompt', async () => {
      prisma.managedPrompt.findUnique.mockResolvedValue(null);

      await expect(service.assertPromptTeamAccess('missing', 'u1', 'viewer'))
        .rejects.toThrow(NotFoundException);
    });
  });

  // ── createTeam ──

  describe('createTeam', () => {
    it('should create a team and add creator as lead', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', role: 'admin' });
      prisma.teamMember.create.mockResolvedValue({});

      const result = await service.createTeam('proj-1', 'u1', { name: 'ML Engineering' } as any);

      expect(result).toEqual(mockTeam);
      expect(prisma.team.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          projectId: 'proj-1',
          name: 'ML Engineering',
          slug: 'ml-engineering',
        }),
      });
      expect(prisma.teamMember.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ role: 'lead' }),
      });
    });

    it('should reject non-admin users', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', role: 'member' });

      await expect(service.createTeam('proj-1', 'u1', { name: 'Test' } as any))
        .rejects.toThrow(ForbiddenException);
    });
  });

  // ── listTeams ──

  describe('listTeams', () => {
    it('should return all teams for org admin', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', role: 'admin' });

      await service.listTeams('proj-1', 'u1');

      expect(prisma.team.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { projectId: 'proj-1' } }),
      );
    });

    it('should return only member teams for org member', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', role: 'member' });

      await service.listTeams('proj-1', 'u1');

      expect(prisma.team.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { projectId: 'proj-1', members: { some: { userId: 'u1' } } },
        }),
      );
    });
  });

  // ── deleteTeam ──

  describe('deleteTeam', () => {
    it('should delete team for org admin', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', role: 'admin' });

      const result = await service.deleteTeam('proj-1', 'team-1', 'u1');

      expect(result).toEqual({ deleted: true });
      expect(prisma.team.delete).toHaveBeenCalledWith({ where: { id: 'team-1' } });
    });

    it('should reject non-admin', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', role: 'member' });

      await expect(service.deleteTeam('proj-1', 'team-1', 'u1'))
        .rejects.toThrow(ForbiddenException);
    });
  });

  // ── addMember ──

  describe('addMember', () => {
    it('should add a member with default editor role', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce({ id: 'u1', role: 'admin' }) // assertTeamRole
        .mockResolvedValueOnce({ id: 'u2', organizationId: 'org-1' }); // target user
      prisma.teamMember.create.mockResolvedValue({
        id: 'tm-1', teamId: 'team-1', userId: 'u2', role: 'editor',
        user: { email: 'bob@co.com' },
      });

      const result = await service.addMember('proj-1', 'team-1', 'u1', {
        userId: 'u2',
      } as any);

      expect(result.role).toBe('editor');
    });

    it('should reject if target user not in same org', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce({ id: 'u1', role: 'admin' })
        .mockResolvedValueOnce({ id: 'u2', organizationId: 'other-org' });

      await expect(service.addMember('proj-1', 'team-1', 'u1', { userId: 'u2' } as any))
        .rejects.toThrow(NotFoundException);
    });
  });

  // ── removeMember ──

  describe('removeMember', () => {
    it('should remove a member', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', role: 'admin' });
      prisma.teamMember.findUnique.mockResolvedValue({ id: 'tm-1', role: 'editor' });

      const result = await service.removeMember('proj-1', 'team-1', 'u1', 'u2');

      expect(result).toEqual({ removed: true });
    });

    it('should not remove the last lead', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', role: 'admin' });
      prisma.teamMember.findUnique.mockResolvedValue({ id: 'tm-1', role: 'lead' });
      prisma.teamMember.count.mockResolvedValue(1);

      await expect(service.removeMember('proj-1', 'team-1', 'u1', 'u2'))
        .rejects.toThrow(BadRequestException);
    });
  });

  // ── updateMemberRole ──

  describe('updateMemberRole', () => {
    it('should update a member role', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', role: 'admin' });
      prisma.teamMember.findUnique.mockResolvedValue({ id: 'tm-1', role: 'editor' });
      prisma.teamMember.update.mockResolvedValue({ id: 'tm-1', role: 'lead', user: { email: 'bob@co.com' } });

      const result = await service.updateMemberRole('proj-1', 'team-1', 'u1', 'u2', 'lead');

      expect(result.role).toBe('lead');
    });

    it('should not demote the last lead', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', role: 'admin' });
      prisma.teamMember.findUnique.mockResolvedValue({ id: 'tm-1', role: 'lead' });
      prisma.teamMember.count.mockResolvedValue(1);

      await expect(service.updateMemberRole('proj-1', 'team-1', 'u1', 'u2', 'editor'))
        .rejects.toThrow(BadRequestException);
    });
  });
});
