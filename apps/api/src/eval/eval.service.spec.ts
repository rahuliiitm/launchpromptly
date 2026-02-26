import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EvalService } from './eval.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectService } from '../project/project.service';
import { TeamService } from '../team/team.service';

describe('EvalService', () => {
  let service: EvalService;
  let prisma: any;
  let projectService: ProjectService;
  let config: ConfigService;

  const mockDataset = {
    id: 'ds-1',
    managedPromptId: 'p-1',
    name: 'Golden Dataset',
    description: '',
    passThreshold: 3.5,
    createdAt: new Date(),
  };

  const mockCase = {
    id: 'case-1',
    datasetId: 'ds-1',
    input: 'How do I reset my password?',
    expectedOutput: 'Click forgot password on the login page.',
    variables: null,
    criteria: null,
    sortOrder: 0,
    createdAt: new Date(),
  };

  const mockVersion = {
    id: 'v-1',
    managedPromptId: 'p-1',
    version: 1,
    content: 'You are a customer support agent.',
    status: 'draft',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    prisma = {
      evalDataset: {
        create: jest.fn().mockResolvedValue(mockDataset),
        findMany: jest.fn().mockResolvedValue([mockDataset]),
        findFirst: jest.fn().mockResolvedValue(mockDataset),
        delete: jest.fn().mockResolvedValue(mockDataset),
        count: jest.fn().mockResolvedValue(0),
      },
      evalCase: {
        create: jest.fn().mockResolvedValue(mockCase),
        findFirst: jest.fn().mockResolvedValue(mockCase),
        delete: jest.fn().mockResolvedValue(mockCase),
        aggregate: jest.fn().mockResolvedValue({ _max: { sortOrder: 0 } }),
      },
      evalRun: {
        create: jest.fn().mockResolvedValue({ id: 'run-1', status: 'running' }),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
        count: jest.fn().mockResolvedValue(0),
      },
      evalResult: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      managedPrompt: {
        findFirst: jest.fn().mockResolvedValue({ id: 'p-1', projectId: 'proj-1' }),
      },
      promptVersion: {
        findFirst: jest.fn().mockResolvedValue(mockVersion),
      },
      project: {
        findUnique: jest.fn().mockResolvedValue({ id: 'proj-1', organizationId: 'org-1' }),
      },
      organization: {
        findUnique: jest.fn().mockResolvedValue({ plan: 'free' }),
      },
    } as unknown as PrismaService;

    projectService = {
      assertProjectAccess: jest.fn().mockResolvedValue(undefined),
    } as unknown as ProjectService;

    config = {
      get: jest.fn().mockReturnValue(null), // No ANTHROPIC_API_KEY by default
    } as unknown as ConfigService;

    const teamService = {
      assertTeamRole: jest.fn().mockResolvedValue(undefined),
      assertPromptTeamAccess: jest.fn().mockResolvedValue(undefined),
    } as unknown as TeamService;

    service = new EvalService(prisma, projectService, teamService, config);
  });

  describe('createDataset', () => {
    it('should create a dataset with default threshold', async () => {
      const result = await service.createDataset('proj-1', 'p-1', 'user-1', {
        name: 'Golden Dataset',
      });

      expect(result).toEqual(mockDataset);
      expect(prisma.evalDataset.create).toHaveBeenCalledWith({
        data: {
          managedPromptId: 'p-1',
          name: 'Golden Dataset',
          description: '',
          passThreshold: 3.5,
        },
      });
    });

    it('should create a dataset with custom threshold', async () => {
      await service.createDataset('proj-1', 'p-1', 'user-1', {
        name: 'Strict Dataset',
        passThreshold: 4.0,
        description: 'High bar',
      });

      expect(prisma.evalDataset.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          passThreshold: 4.0,
          description: 'High bar',
        }),
      });
    });

    it('should throw if prompt not found', async () => {
      prisma.managedPrompt.findFirst.mockResolvedValue(null);

      await expect(
        service.createDataset('proj-1', 'p-missing', 'user-1', { name: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('listDatasets', () => {
    it('should return datasets with counts', async () => {
      const result = await service.listDatasets('proj-1', 'p-1', 'user-1');
      expect(result).toEqual([mockDataset]);
      expect(prisma.evalDataset.findMany).toHaveBeenCalledWith({
        where: { managedPromptId: 'p-1' },
        include: { _count: { select: { cases: true, runs: true } } },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('getDataset', () => {
    it('should return dataset with cases', async () => {
      prisma.evalDataset.findFirst.mockResolvedValue({
        ...mockDataset,
        cases: [mockCase],
        _count: { cases: 1, runs: 0 },
      });

      const result = await service.getDataset('proj-1', 'p-1', 'ds-1', 'user-1');
      expect(result.cases).toHaveLength(1);
    });

    it('should throw if dataset not found', async () => {
      prisma.evalDataset.findFirst.mockResolvedValue(null);

      await expect(
        service.getDataset('proj-1', 'p-1', 'ds-missing', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteDataset', () => {
    it('should delete the dataset', async () => {
      await service.deleteDataset('proj-1', 'p-1', 'ds-1', 'user-1');
      expect(prisma.evalDataset.delete).toHaveBeenCalledWith({ where: { id: 'ds-1' } });
    });

    it('should throw if dataset not found', async () => {
      prisma.evalDataset.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteDataset('proj-1', 'p-1', 'ds-missing', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('addCase', () => {
    it('should add a case with auto-incremented sort order', async () => {
      await service.addCase('proj-1', 'p-1', 'ds-1', 'user-1', {
        input: 'How do I cancel?',
      });

      expect(prisma.evalCase.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          datasetId: 'ds-1',
          input: 'How do I cancel?',
          sortOrder: 1,
        }),
      });
    });

    it('should throw if dataset not found', async () => {
      prisma.evalDataset.findFirst.mockResolvedValue(null);

      await expect(
        service.addCase('proj-1', 'p-1', 'ds-missing', 'user-1', { input: 'test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteCase', () => {
    it('should delete the case', async () => {
      await service.deleteCase('proj-1', 'p-1', 'ds-1', 'case-1', 'user-1');
      expect(prisma.evalCase.delete).toHaveBeenCalledWith({ where: { id: 'case-1' } });
    });

    it('should throw if case not found', async () => {
      prisma.evalCase.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteCase('proj-1', 'p-1', 'ds-1', 'case-missing', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('runEval', () => {
    it('should throw when ANTHROPIC_API_KEY not configured', async () => {
      prisma.evalDataset.findFirst.mockResolvedValue({
        ...mockDataset,
        cases: [mockCase],
      });

      await expect(
        service.runEval('proj-1', 'p-1', 'ds-1', 'v-1', 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw when dataset is empty', async () => {
      prisma.evalDataset.findFirst.mockResolvedValue({
        ...mockDataset,
        cases: [],
      });

      await expect(
        service.runEval('proj-1', 'p-1', 'ds-1', 'v-1', 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw when version not found', async () => {
      prisma.evalDataset.findFirst.mockResolvedValue({
        ...mockDataset,
        cases: [mockCase],
      });
      prisma.promptVersion.findFirst.mockResolvedValue(null);

      await expect(
        service.runEval('proj-1', 'p-1', 'ds-1', 'v-missing', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw when dataset not found', async () => {
      prisma.evalDataset.findFirst.mockResolvedValue(null);

      await expect(
        service.runEval('proj-1', 'p-1', 'ds-missing', 'v-1', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('hasPassingEval', () => {
    it('should return true when a passing run exists', async () => {
      prisma.evalRun.findFirst.mockResolvedValue({ id: 'run-1', passed: true });
      const result = await service.hasPassingEval('p-1', 'v-1');
      expect(result).toBe(true);
    });

    it('should return false when no passing run exists', async () => {
      prisma.evalRun.findFirst.mockResolvedValue(null);
      const result = await service.hasPassingEval('p-1', 'v-1');
      expect(result).toBe(false);
    });
  });

  describe('generateDataset', () => {
    it('should throw when ANTHROPIC_API_KEY not configured', async () => {
      await expect(
        service.generateDataset('proj-1', 'p-1', 'user-1', { promptVersionId: 'v-1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw when version not found', async () => {
      // Create service with API key configured
      const configWithKey = { get: jest.fn().mockReturnValue('test-key') } as unknown as ConfigService;
      const teamService = {
        assertTeamRole: jest.fn().mockResolvedValue(undefined),
        assertPromptTeamAccess: jest.fn().mockResolvedValue(undefined),
      } as unknown as TeamService;
      const svc = new EvalService(prisma, projectService, teamService, configWithKey);
      prisma.promptVersion.findFirst.mockResolvedValue(null);

      await expect(
        svc.generateDataset('proj-1', 'p-1', 'user-1', { promptVersionId: 'v-missing' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('parseGeneratedCases', () => {
    const callParse = (text: string) => {
      return (service as any).parseGeneratedCases(text);
    };

    it('should parse valid JSON response', () => {
      const result = callParse(JSON.stringify({
        description: 'Test cases',
        cases: [{ input: 'hello', criteria: 'must greet back' }],
      }));
      expect(result.description).toBe('Test cases');
      expect(result.cases).toHaveLength(1);
      expect(result.cases[0].criteria).toBe('must greet back');
    });

    it('should handle markdown code blocks', () => {
      const result = callParse('```json\n{"description": "test", "cases": [{"input": "hi", "criteria": "respond"}]}\n```');
      expect(result.cases).toHaveLength(1);
    });

    it('should handle malformed JSON gracefully', () => {
      const result = callParse('This is not JSON at all');
      expect(result.description).toBe('Auto-generated test cases');
      expect(result.cases).toHaveLength(0);
    });
  });

  describe('parseJudgeResponse', () => {
    // Access private method for testing
    const callParse = (text: string) => {
      return (service as any).parseJudgeResponse(text);
    };

    it('should parse valid JSON response', () => {
      const result = callParse('{"score": 4, "reasoning": "Well-structured prompt"}');
      expect(result.score).toBe(4);
      expect(result.reasoning).toBe('Well-structured prompt');
    });

    it('should clamp score to 1-5 range', () => {
      expect(callParse('{"score": 10, "reasoning": "test"}').score).toBe(5);
      expect(callParse('{"score": 0, "reasoning": "test"}').score).toBe(1);
    });

    it('should handle invalid JSON gracefully', () => {
      const result = callParse('This is not JSON');
      expect(result.score).toBe(3);
      expect(result.reasoning).toContain('Could not parse');
    });

    it('should extract JSON from surrounding text', () => {
      const result = callParse('Here is my evaluation:\n{"score": 5, "reasoning": "Excellent"}');
      expect(result.score).toBe(5);
      expect(result.reasoning).toBe('Excellent');
    });
  });
});
