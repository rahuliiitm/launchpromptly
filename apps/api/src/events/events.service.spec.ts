import { EventsService } from './events.service';
import { PrismaService } from '../prisma/prisma.service';

describe('EventsService', () => {
  let service: EventsService;
  let prisma: PrismaService;

  beforeEach(() => {
    prisma = {
      lLMEvent: {
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    } as unknown as PrismaService;

    service = new EventsService(prisma);
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
});
