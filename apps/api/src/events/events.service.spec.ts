import { EventsService } from './events.service';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../crypto/crypto.service';
import { AuditService } from '../audit/audit.service';
import { AlertService } from '../alert/alert.service';
import { UsageService } from '../billing/usage.service';
import { ProjectService } from '../project/project.service';

describe('EventsService', () => {
  let service: EventsService;
  let prisma: PrismaService;
  let crypto: CryptoService;
  let audit: AuditService;
  let alertService: AlertService;
  let usageService: UsageService;
  let projectService: ProjectService;

  beforeEach(() => {
    prisma = {
      lLMEvent: {
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      auditLog: {
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    } as unknown as PrismaService;

    crypto = {
      encrypt: jest.fn().mockReturnValue({ encrypted: 'enc', iv: 'iv', authTag: 'tag' }),
      decrypt: jest.fn().mockReturnValue('decrypted'),
    } as unknown as CryptoService;

    audit = {
      log: jest.fn().mockResolvedValue(undefined),
    } as unknown as AuditService;

    alertService = {
      evaluateAlerts: jest.fn().mockResolvedValue(undefined),
    } as unknown as AlertService;

    usageService = {
      checkQuota: jest.fn().mockResolvedValue({ allowed: true, remaining: 999, limit: 1000 }),
    } as unknown as UsageService;

    projectService = {
      assertProjectAccess: jest.fn().mockResolvedValue(undefined),
    } as unknown as ProjectService;

    service = new EventsService(prisma, crypto, audit, alertService, usageService, projectService);
  });

  const baseEvent = {
    provider: 'openai' as const,
    model: 'gpt-4o',
    inputTokens: 100,
    outputTokens: 50,
    totalTokens: 150,
    costUsd: 0.001,
    latencyMs: 200,
  };

  it('should insert events via createMany', async () => {
    const result = await service.ingestBatch('project-123', {
      events: [baseEvent, { ...baseEvent, model: 'gpt-4o-mini' }],
    });

    expect(result.accepted).toBe(2);
    expect(prisma.lLMEvent.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ projectId: 'project-123', model: 'gpt-4o' }),
        expect.objectContaining({ projectId: 'project-123', model: 'gpt-4o-mini' }),
      ]),
    });
  });

  it('should set null for optional fields when not provided', async () => {
    await service.ingestBatch('project-123', {
      events: [baseEvent],
    });

    const createManyCall = (prisma.lLMEvent.createMany as jest.Mock).mock.calls[0][0];
    const eventData = createManyCall.data[0];
    expect(eventData.customerId).toBeNull();
    expect(eventData.feature).toBeNull();
    expect(eventData.systemHash).toBeNull();
    expect(eventData.statusCode).toBe(200);
  });

  it('should pass through optional fields when provided', async () => {
    await service.ingestBatch('project-123', {
      events: [{
        ...baseEvent,
        customerId: 'cust-1',
        feature: 'chat',
        statusCode: 201,
      }],
    });

    const createManyCall = (prisma.lLMEvent.createMany as jest.Mock).mock.calls[0][0];
    const eventData = createManyCall.data[0];
    expect(eventData.customerId).toBe('cust-1');
    expect(eventData.feature).toBe('chat');
    expect(eventData.statusCode).toBe(201);
  });

  it('should pass through environmentId from event payload', async () => {
    await service.ingestBatch('project-123', {
      events: [{ ...baseEvent, environmentId: 'env-prod' }],
    });

    const createManyCall = (prisma.lLMEvent.createMany as jest.Mock).mock.calls[0][0];
    const eventData = createManyCall.data[0];
    expect(eventData.environmentId).toBe('env-prod');
  });

  it('should use request environmentId when event has no environmentId', async () => {
    await service.ingestBatch('project-123', {
      events: [baseEvent],
    }, 'env-from-key');

    const createManyCall = (prisma.lLMEvent.createMany as jest.Mock).mock.calls[0][0];
    const eventData = createManyCall.data[0];
    expect(eventData.environmentId).toBe('env-from-key');
  });

  it('should prefer event environmentId over request environmentId', async () => {
    await service.ingestBatch('project-123', {
      events: [{ ...baseEvent, environmentId: 'env-from-event' }],
    }, 'env-from-key');

    const createManyCall = (prisma.lLMEvent.createMany as jest.Mock).mock.calls[0][0];
    const eventData = createManyCall.data[0];
    expect(eventData.environmentId).toBe('env-from-event');
  });

  it('should set environmentId to null when neither event nor request has it', async () => {
    await service.ingestBatch('project-123', {
      events: [baseEvent],
    });

    const createManyCall = (prisma.lLMEvent.createMany as jest.Mock).mock.calls[0][0];
    const eventData = createManyCall.data[0];
    expect(eventData.environmentId).toBeNull();
  });

});
