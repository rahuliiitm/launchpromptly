import { NotFoundException } from '@nestjs/common';
import { AlertService } from './alert.service';

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockPrisma = {
  alertRule: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

const mockProjectService = {
  assertProjectAccess: jest.fn().mockResolvedValue(undefined),
};

const mockAudit = {
  log: jest.fn().mockResolvedValue(undefined),
};

const mockEmail = {
  sendAlertEmail: jest.fn().mockResolvedValue(undefined),
};

// Mock global fetch
const mockFetch = jest.fn().mockResolvedValue({ ok: true });
global.fetch = mockFetch as unknown as typeof fetch;

function buildService() {
  return new AlertService(
    mockPrisma as any,
    mockProjectService as any,
    mockAudit as any,
    mockEmail as any,
  );
}

const baseRule = {
  id: 'rule-1',
  projectId: 'proj-1',
  name: 'PII Alert',
  condition: { type: 'pii_threshold', threshold: 3 },
  channel: 'webhook',
  webhookUrl: 'https://example.com/hook',
  email: null,
  throttleMinutes: 60,
  enabled: true,
  lastFiredAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ── Tests ──────────────────────────────────────────────────────────────────

describe('AlertService', () => {
  let service: AlertService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockResolvedValue({ ok: true });
    mockEmail.sendAlertEmail.mockResolvedValue(undefined);
    mockAudit.log.mockResolvedValue(undefined);
    mockProjectService.assertProjectAccess.mockResolvedValue(undefined);
    service = buildService();
  });

  // ── CRUD ──

  describe('create', () => {
    it('should create an alert rule', async () => {
      const dto = { name: 'Test', condition: { type: 'pii_threshold', threshold: 5 } };
      mockPrisma.alertRule.create.mockResolvedValue({ ...baseRule, ...dto });

      const result = await service.create('proj-1', 'user-1', dto);

      expect(mockProjectService.assertProjectAccess).toHaveBeenCalledWith('proj-1', 'user-1');
      expect(mockPrisma.alertRule.create).toHaveBeenCalled();
      expect(result.name).toBe('Test');
    });
  });

  describe('findAll', () => {
    it('should return all rules for a project', async () => {
      mockPrisma.alertRule.findMany.mockResolvedValue([baseRule]);

      const result = await service.findAll('proj-1', 'user-1');

      expect(result).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException when rule not found', async () => {
      mockPrisma.alertRule.findFirst.mockResolvedValue(null);

      await expect(service.findOne('proj-1', 'user-1', 'missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete and audit-log', async () => {
      mockPrisma.alertRule.findFirst.mockResolvedValue(baseRule);
      mockPrisma.alertRule.delete.mockResolvedValue(baseRule);

      await service.remove('proj-1', 'user-1', 'rule-1');

      expect(mockPrisma.alertRule.delete).toHaveBeenCalledWith({ where: { id: 'rule-1' } });
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'alert_rule_deleted' }),
      );
    });
  });

  // ── Condition Evaluation ──

  describe('evaluateAlerts — condition logic', () => {
    it('should fire pii_threshold when count exceeds threshold', async () => {
      mockPrisma.alertRule.findMany.mockResolvedValue([{ ...baseRule }]);
      mockPrisma.alertRule.update.mockResolvedValue(baseRule);

      await service.evaluateAlerts('proj-1', { piiDetectionCount: 5 });

      expect(mockPrisma.alertRule.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'rule-1' } }),
      );
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should NOT fire pii_threshold when count is below', async () => {
      mockPrisma.alertRule.findMany.mockResolvedValue([{ ...baseRule }]);

      await service.evaluateAlerts('proj-1', { piiDetectionCount: 2 });

      expect(mockPrisma.alertRule.update).not.toHaveBeenCalled();
    });

    it('should fire injection_blocked when action is block', async () => {
      const rule = { ...baseRule, condition: { type: 'injection_blocked' } };
      mockPrisma.alertRule.findMany.mockResolvedValue([rule]);
      mockPrisma.alertRule.update.mockResolvedValue(rule);

      await service.evaluateAlerts('proj-1', { injectionAction: 'block' });

      expect(mockPrisma.alertRule.update).toHaveBeenCalled();
    });

    it('should NOT fire injection_blocked when action is warn', async () => {
      const rule = { ...baseRule, condition: { type: 'injection_blocked' } };
      mockPrisma.alertRule.findMany.mockResolvedValue([rule]);

      await service.evaluateAlerts('proj-1', { injectionAction: 'warn' });

      expect(mockPrisma.alertRule.update).not.toHaveBeenCalled();
    });

    it('should fire cost_exceeded when cost is above threshold', async () => {
      const rule = { ...baseRule, condition: { type: 'cost_exceeded', threshold: 1.0 } };
      mockPrisma.alertRule.findMany.mockResolvedValue([rule]);
      mockPrisma.alertRule.update.mockResolvedValue(rule);

      await service.evaluateAlerts('proj-1', { costUsd: 2.5 });

      expect(mockPrisma.alertRule.update).toHaveBeenCalled();
    });

    it('should NOT fire cost_exceeded when cost is below threshold', async () => {
      const rule = { ...baseRule, condition: { type: 'cost_exceeded', threshold: 5.0 } };
      mockPrisma.alertRule.findMany.mockResolvedValue([rule]);

      await service.evaluateAlerts('proj-1', { costUsd: 2.0 });

      expect(mockPrisma.alertRule.update).not.toHaveBeenCalled();
    });

    it('should fire content_violation when violations exist', async () => {
      const rule = { ...baseRule, condition: { type: 'content_violation' } };
      mockPrisma.alertRule.findMany.mockResolvedValue([rule]);
      mockPrisma.alertRule.update.mockResolvedValue(rule);

      await service.evaluateAlerts('proj-1', {
        contentViolations: {
          inputViolations: [{ category: 'hate_speech', matched: 'test', severity: 'high' }],
          outputViolations: [],
        },
      });

      expect(mockPrisma.alertRule.update).toHaveBeenCalled();
    });

    it('should NOT fire content_violation when no violations', async () => {
      const rule = { ...baseRule, condition: { type: 'content_violation' } };
      mockPrisma.alertRule.findMany.mockResolvedValue([rule]);

      await service.evaluateAlerts('proj-1', {
        contentViolations: { inputViolations: [], outputViolations: [] },
      });

      expect(mockPrisma.alertRule.update).not.toHaveBeenCalled();
    });
  });

  // ── Throttling ──

  describe('evaluateAlerts — throttling', () => {
    it('should skip rule within throttle window', async () => {
      const recentFire = new Date(Date.now() - 10 * 60 * 1000); // 10 min ago
      const rule = { ...baseRule, lastFiredAt: recentFire, throttleMinutes: 60 };
      mockPrisma.alertRule.findMany.mockResolvedValue([rule]);

      await service.evaluateAlerts('proj-1', { piiDetectionCount: 10 });

      expect(mockPrisma.alertRule.update).not.toHaveBeenCalled();
    });

    it('should fire rule after throttle window expires', async () => {
      const oldFire = new Date(Date.now() - 90 * 60 * 1000); // 90 min ago
      const rule = { ...baseRule, lastFiredAt: oldFire, throttleMinutes: 60 };
      mockPrisma.alertRule.findMany.mockResolvedValue([rule]);
      mockPrisma.alertRule.update.mockResolvedValue(rule);

      await service.evaluateAlerts('proj-1', { piiDetectionCount: 10 });

      expect(mockPrisma.alertRule.update).toHaveBeenCalled();
    });
  });

  // ── Delivery Channels ──

  describe('deliverAlert — webhook', () => {
    it('should POST JSON to webhookUrl', async () => {
      mockPrisma.alertRule.findMany.mockResolvedValue([{ ...baseRule }]);
      mockPrisma.alertRule.update.mockResolvedValue(baseRule);

      await service.evaluateAlerts('proj-1', { piiDetectionCount: 10 });

      // Wait for fire-and-forget delivery
      await new Promise(r => setTimeout(r, 50));

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/hook',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  describe('deliverAlert — email', () => {
    it('should call EmailService.sendAlertEmail', async () => {
      const rule = { ...baseRule, channel: 'email', email: 'test@example.com', webhookUrl: null };
      mockPrisma.alertRule.findMany.mockResolvedValue([rule]);
      mockPrisma.alertRule.update.mockResolvedValue(rule);

      await service.evaluateAlerts('proj-1', { piiDetectionCount: 10 });

      await new Promise(r => setTimeout(r, 50));

      expect(mockEmail.sendAlertEmail).toHaveBeenCalledWith(
        'test@example.com',
        'PII Alert',
        'pii_threshold',
        expect.objectContaining({ piiDetectionCount: 10 }),
      );
    });
  });

  describe('deliverAlert — slack', () => {
    it('should POST Slack Block Kit payload to webhookUrl', async () => {
      const rule = { ...baseRule, channel: 'slack', webhookUrl: 'https://hooks.slack.com/test' };
      mockPrisma.alertRule.findMany.mockResolvedValue([rule]);
      mockPrisma.alertRule.update.mockResolvedValue(rule);

      await service.evaluateAlerts('proj-1', { piiDetectionCount: 10 });

      await new Promise(r => setTimeout(r, 50));

      expect(mockFetch).toHaveBeenCalledWith(
        'https://hooks.slack.com/test',
        expect.objectContaining({ method: 'POST' }),
      );
      // Verify Slack payload format
      const callBody = JSON.parse(mockFetch.mock.calls.find(
        (c: unknown[]) => c[0] === 'https://hooks.slack.com/test',
      )?.[1]?.body ?? '{}');
      expect(callBody.blocks).toBeDefined();
      expect(callBody.blocks[0].type).toBe('header');
    });
  });

  describe('deliverAlert — failure logging', () => {
    it('should audit-log delivery failure without throwing', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));
      const rule = { ...baseRule };
      mockPrisma.alertRule.findMany.mockResolvedValue([rule]);
      mockPrisma.alertRule.update.mockResolvedValue(rule);

      await service.evaluateAlerts('proj-1', { piiDetectionCount: 10 });

      await new Promise(r => setTimeout(r, 50));

      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'alert_delivery_failed', severity: 'warning' }),
      );
    });
  });
});
