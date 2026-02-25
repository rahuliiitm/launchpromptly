/**
 * Tests for billing webhook verification, signature security, and event processing.
 * Tests the BillingService directly (verifySignature + processWebhookEvent)
 * since the controller is a thin wrapper that delegates to the service.
 */
import { createHmac } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { BillingService } from './billing.service';
import { PrismaService } from '../prisma/prisma.service';

describe('BillingService — Webhook Security', () => {
  let service: BillingService;
  let prisma: PrismaService;
  const WEBHOOK_SECRET = 'test-secret-key';

  function signBody(body: unknown, secret = WEBHOOK_SECRET): string {
    return createHmac('sha256', secret).update(JSON.stringify(body)).digest('hex');
  }

  beforeEach(() => {
    prisma = {
      organization: {
        findUnique: jest.fn().mockResolvedValue({ plan: 'free' }),
        update: jest.fn().mockResolvedValue({ plan: 'pro' }),
      },
    } as unknown as PrismaService;

    const configService = {
      get: jest.fn().mockImplementation((key: string) => {
        const map: Record<string, string> = {
          LS_WEBHOOK_SECRET: WEBHOOK_SECRET,
          LS_STORE_ID: 'test-store',
          LS_VARIANT_PRO: 'variant-pro-123',
          LS_VARIANT_TEAM: 'variant-team-456',
        };
        return map[key] ?? '';
      }),
    } as unknown as ConfigService;

    service = new BillingService(prisma, configService);
  });

  // ─── Signature verification ───

  describe('verifySignature', () => {
    it('should accept valid HMAC-SHA256 signature', () => {
      const body = { meta: { event_name: 'subscription_created' } };
      const sig = signBody(body);
      expect(service.verifySignature(JSON.stringify(body), sig)).toBe(true);
    });

    it('should reject invalid signature', () => {
      const body = { meta: { event_name: 'subscription_created' } };
      expect(service.verifySignature(JSON.stringify(body), 'invalid-signature')).toBe(false);
    });

    it('should reject signature from wrong secret', () => {
      const body = { meta: { event_name: 'subscription_created' } };
      const wrongSig = signBody(body, 'wrong-secret');
      expect(service.verifySignature(JSON.stringify(body), wrongSig)).toBe(false);
    });

    it('should reject when webhook secret is not configured', () => {
      const emptyConfig = {
        get: jest.fn().mockReturnValue(''),
      } as unknown as ConfigService;
      const svc = new BillingService(prisma, emptyConfig);
      expect(svc.verifySignature('any body', 'any sig')).toBe(false);
    });

    it('should reject tampered body (body changed after signing)', () => {
      const originalBody = {
        meta: { event_name: 'subscription_created', custom_data: { org_id: 'org-1' } },
        data: { id: 'sub-1', attributes: { variant_id: 'free', status: 'active' } },
      };
      const sig = signBody(originalBody);

      // Attacker tampers with variant_id
      const tampered = {
        ...originalBody,
        data: {
          ...originalBody.data,
          attributes: { variant_id: 'premium-enterprise', status: 'active' },
        },
      };
      expect(service.verifySignature(JSON.stringify(tampered), sig)).toBe(false);
    });

    it('should handle empty body string', () => {
      const sig = createHmac('sha256', WEBHOOK_SECRET).update('').digest('hex');
      expect(service.verifySignature('', sig)).toBe(true);
    });
  });

  // ─── Event processing ───

  describe('processWebhookEvent', () => {
    it('should process subscription_created event', async () => {
      const body = {
        meta: {
          event_name: 'subscription_created',
          custom_data: { org_id: 'org-123' },
        },
        data: {
          id: 'sub-1',
          attributes: {
            customer_id: 'cust-1',
            variant_id: 'variant-pro-123',
            status: 'active',
            ends_at: null,
          },
        },
      };

      const result = await service.processWebhookEvent(body);
      expect(result.handled).toBe(true);
      expect(prisma.organization.update).toHaveBeenCalledWith({
        where: { id: 'org-123' },
        data: expect.objectContaining({ plan: 'pro', lsSubscriptionStatus: 'active' }),
      });
    });

    it('should process subscription_updated event', async () => {
      const body = {
        meta: {
          event_name: 'subscription_updated',
          custom_data: { org_id: 'org-456' },
        },
        data: {
          id: 'sub-2',
          attributes: {
            customer_id: 'cust-2',
            variant_id: 'variant-team-456',
            status: 'active',
            ends_at: null,
          },
        },
      };

      const result = await service.processWebhookEvent(body);
      expect(result.handled).toBe(true);
      expect(prisma.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ plan: 'business' }),
        }),
      );
    });

    it('should process subscription_resumed event', async () => {
      const body = {
        meta: {
          event_name: 'subscription_resumed',
          custom_data: { org_id: 'org-789' },
        },
        data: {
          id: 'sub-3',
          attributes: {
            customer_id: 'cust-3',
            variant_id: 'variant-pro-123',
            status: 'active',
            ends_at: null,
          },
        },
      };

      const result = await service.processWebhookEvent(body);
      expect(result.handled).toBe(true);
    });

    it('should process subscription_cancelled event', async () => {
      const body = {
        meta: {
          event_name: 'subscription_cancelled',
          custom_data: { org_id: 'org-123' },
        },
        data: {
          id: 'sub-1',
          attributes: {
            status: 'cancelled',
            ends_at: '2026-04-01T00:00:00Z',
          },
        },
      };

      const result = await service.processWebhookEvent(body);
      expect(result.handled).toBe(true);
      expect(prisma.organization.update).toHaveBeenCalledWith({
        where: { id: 'org-123' },
        data: {
          lsSubscriptionStatus: 'cancelled',
          planExpiresAt: new Date('2026-04-01T00:00:00Z'),
        },
      });
    });

    it('should process subscription_expired event and downgrade to free', async () => {
      const body = {
        meta: {
          event_name: 'subscription_expired',
          custom_data: { org_id: 'org-123' },
        },
        data: {
          id: 'sub-1',
          attributes: { status: 'expired' },
        },
      };

      const result = await service.processWebhookEvent(body);
      expect(result.handled).toBe(true);
      expect(prisma.organization.update).toHaveBeenCalledWith({
        where: { id: 'org-123' },
        data: { plan: 'free', lsSubscriptionStatus: 'expired', planExpiresAt: null },
      });
    });

    it('should return not handled for missing org_id', async () => {
      const body = {
        meta: { event_name: 'subscription_created', custom_data: {} },
        data: { id: 'sub-1', attributes: {} },
      };

      const result = await service.processWebhookEvent(body);
      expect(result.handled).toBe(false);
      expect(result.error).toContain('no org_id');
      expect(prisma.organization.update).not.toHaveBeenCalled();
    });

    it('should return not handled for unknown event type', async () => {
      const body = {
        meta: {
          event_name: 'order_created',
          custom_data: { org_id: 'org-123' },
        },
        data: { id: '1', attributes: {} },
      };

      const result = await service.processWebhookEvent(body);
      expect(result.handled).toBe(false);
      expect(prisma.organization.update).not.toHaveBeenCalled();
    });

    it('should handle null custom_data gracefully', async () => {
      const body = {
        meta: { event_name: 'subscription_created', custom_data: null },
        data: { id: '1', attributes: {} },
      };

      const result = await service.processWebhookEvent(body);
      expect(result.handled).toBe(false);
    });

    it('should handle missing meta gracefully', async () => {
      const body = { data: { id: '1' } };

      const result = await service.processWebhookEvent(body);
      expect(result.handled).toBe(false);
    });
  });

  // ─── Injection attacks on webhook data ───

  describe('Injection via webhook payload', () => {
    it('should safely pass SQL injection in org_id to Prisma (parameterized)', async () => {
      const body = {
        meta: {
          event_name: 'subscription_created',
          custom_data: { org_id: "'; DROP TABLE organizations; --" },
        },
        data: {
          id: 'sub-1',
          attributes: {
            customer_id: 'cust-1',
            variant_id: 'variant-pro-123',
            status: 'active',
            ends_at: null,
          },
        },
      };

      await service.processWebhookEvent(body);
      expect(prisma.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "'; DROP TABLE organizations; --" },
        }),
      );
    });

    it('should safely handle XSS in customer_id', async () => {
      const body = {
        meta: {
          event_name: 'subscription_created',
          custom_data: { org_id: 'org-123' },
        },
        data: {
          id: 'sub-1',
          attributes: {
            customer_id: '<script>alert(document.cookie)</script>',
            variant_id: 'variant-pro-123',
            status: 'active',
            ends_at: null,
          },
        },
      };

      await service.processWebhookEvent(body);
      expect(prisma.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lsCustomerId: '<script>alert(document.cookie)</script>',
          }),
        }),
      );
    });
  });
});
