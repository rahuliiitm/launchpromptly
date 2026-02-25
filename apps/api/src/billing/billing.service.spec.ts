import { ConfigService } from '@nestjs/config';
import { BillingService } from './billing.service';
import { PrismaService } from '../prisma/prisma.service';

describe('BillingService', () => {
  let service: BillingService;
  let prisma: PrismaService;
  let configService: ConfigService;

  const mockOrg = {
    id: 'org-123',
    plan: 'free',
    lsCustomerId: null,
    lsSubscriptionId: null,
    lsSubscriptionStatus: null,
    lsVariantId: null,
    planExpiresAt: null,
  };

  beforeEach(() => {
    prisma = {
      organization: {
        findUnique: jest.fn().mockResolvedValue(mockOrg),
        update: jest.fn().mockResolvedValue({ ...mockOrg, plan: 'pro' }),
      },
    } as unknown as PrismaService;

    configService = {
      get: jest.fn().mockImplementation((key: string, defaultVal?: string) => {
        const map: Record<string, string> = {
          LS_WEBHOOK_SECRET: 'test-webhook-secret',
          LS_STORE_ID: 'test-store',
          LS_VARIANT_PRO: 'variant-pro-123',
          LS_VARIANT_TEAM: 'variant-team-456',
        };
        return map[key] ?? defaultVal ?? '';
      }),
    } as unknown as ConfigService;

    service = new BillingService(prisma, configService);
  });

  describe('getCheckoutUrl', () => {
    it('should generate valid Lemon Squeezy checkout URL for pro plan', () => {
      const url = service.getCheckoutUrl('pro', 'org-123');
      expect(url).toContain('test-store.lemonsqueezy.com');
      expect(url).toContain('variant-pro-123');
      expect(url).toContain('[org_id]=org-123');
    });

    it('should generate valid checkout URL for team plan', () => {
      const url = service.getCheckoutUrl('team', 'org-123');
      expect(url).toContain('variant-team-456');
      expect(url).toContain('[org_id]=org-123');
    });

    it('should return empty string when store ID is not configured', () => {
      const emptyConfig = {
        get: jest.fn().mockReturnValue(''),
      } as unknown as ConfigService;
      const svc = new BillingService(prisma, emptyConfig);
      expect(svc.getCheckoutUrl('pro', 'org-123')).toBe('');
    });

    it('should return empty string when variant ID is not configured', () => {
      const partialConfig = {
        get: jest.fn().mockImplementation((key: string) => {
          if (key === 'LS_STORE_ID') return 'my-store';
          return '';
        }),
      } as unknown as ConfigService;
      const svc = new BillingService(prisma, partialConfig);
      expect(svc.getCheckoutUrl('pro', 'org-123')).toBe('');
    });
  });

  describe('getWebhookSecret', () => {
    it('should return configured webhook secret', () => {
      expect(service.getWebhookSecret()).toBe('test-webhook-secret');
    });

    it('should return empty string when not configured', () => {
      const emptyConfig = {
        get: jest.fn().mockReturnValue(''),
      } as unknown as ConfigService;
      const svc = new BillingService(prisma, emptyConfig);
      expect(svc.getWebhookSecret()).toBe('');
    });
  });

  describe('handleSubscriptionChange', () => {
    it('should upgrade org to pro on subscription_created with active status', async () => {
      await service.handleSubscriptionChange({
        organizationId: 'org-123',
        customerId: 'cust-1',
        subscriptionId: 'sub-1',
        variantId: 'variant-pro-123',
        status: 'active',
        endsAt: null,
      });

      expect(prisma.organization.update).toHaveBeenCalledWith({
        where: { id: 'org-123' },
        data: {
          plan: 'pro',
          lsCustomerId: 'cust-1',
          lsSubscriptionId: 'sub-1',
          lsSubscriptionStatus: 'active',
          lsVariantId: 'variant-pro-123',
          planExpiresAt: null,
        },
      });
    });

    it('should upgrade org to business for team variant', async () => {
      await service.handleSubscriptionChange({
        organizationId: 'org-123',
        customerId: 'cust-1',
        subscriptionId: 'sub-1',
        variantId: 'variant-team-456',
        status: 'active',
        endsAt: null,
      });

      expect(prisma.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ plan: 'business' }),
        }),
      );
    });

    it('should handle on_trial status as active plan', async () => {
      await service.handleSubscriptionChange({
        organizationId: 'org-123',
        customerId: 'cust-1',
        subscriptionId: 'sub-1',
        variantId: 'variant-pro-123',
        status: 'on_trial',
        endsAt: null,
      });

      expect(prisma.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ plan: 'pro' }),
        }),
      );
    });

    it('should handle past_due status, keeping plan active', async () => {
      await service.handleSubscriptionChange({
        organizationId: 'org-123',
        customerId: 'cust-1',
        subscriptionId: 'sub-1',
        variantId: 'variant-pro-123',
        status: 'past_due',
        endsAt: null,
      });

      expect(prisma.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ plan: 'pro' }),
        }),
      );
    });

    it('should set planExpiresAt when endsAt is provided', async () => {
      const endsAt = '2026-03-15T00:00:00Z';
      await service.handleSubscriptionChange({
        organizationId: 'org-123',
        customerId: 'cust-1',
        subscriptionId: 'sub-1',
        variantId: 'variant-pro-123',
        status: 'active',
        endsAt,
      });

      expect(prisma.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            planExpiresAt: new Date(endsAt),
          }),
        }),
      );
    });

    it('should default to free plan for unknown variant ID', async () => {
      await service.handleSubscriptionChange({
        organizationId: 'org-123',
        customerId: 'cust-1',
        subscriptionId: 'sub-1',
        variantId: 'unknown-variant',
        status: 'active',
        endsAt: null,
      });

      expect(prisma.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ plan: 'free' }),
        }),
      );
    });

    it('should default to free plan for unknown status', async () => {
      await service.handleSubscriptionChange({
        organizationId: 'org-123',
        customerId: 'cust-1',
        subscriptionId: 'sub-1',
        variantId: 'variant-pro-123',
        status: 'unknown_status',
        endsAt: null,
      });

      expect(prisma.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ plan: 'free' }),
        }),
      );
    });
  });

  describe('handleSubscriptionCancelled', () => {
    it('should set status to cancelled and keep plan until period end', async () => {
      const endsAt = '2026-04-01T00:00:00Z';
      await service.handleSubscriptionCancelled({
        organizationId: 'org-123',
        subscriptionId: 'sub-1',
        endsAt,
      });

      expect(prisma.organization.update).toHaveBeenCalledWith({
        where: { id: 'org-123' },
        data: {
          lsSubscriptionStatus: 'cancelled',
          planExpiresAt: new Date(endsAt),
        },
      });
    });

    it('should handle cancellation without endsAt', async () => {
      await service.handleSubscriptionCancelled({
        organizationId: 'org-123',
        subscriptionId: 'sub-1',
        endsAt: null,
      });

      expect(prisma.organization.update).toHaveBeenCalledWith({
        where: { id: 'org-123' },
        data: {
          lsSubscriptionStatus: 'cancelled',
          planExpiresAt: null,
        },
      });
    });
  });

  describe('handleSubscriptionExpired', () => {
    it('should downgrade org to free plan', async () => {
      await service.handleSubscriptionExpired({
        organizationId: 'org-123',
        subscriptionId: 'sub-1',
      });

      expect(prisma.organization.update).toHaveBeenCalledWith({
        where: { id: 'org-123' },
        data: {
          plan: 'free',
          lsSubscriptionStatus: 'expired',
          planExpiresAt: null,
        },
      });
    });
  });

  describe('getBillingInfo', () => {
    it('should return billing info for existing org', async () => {
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue({
        plan: 'pro',
        lsCustomerId: 'cust-1',
        lsSubscriptionId: 'sub-1',
        lsSubscriptionStatus: 'active',
        planExpiresAt: null,
      });

      const info = await service.getBillingInfo('org-123');

      expect(info).toEqual({
        plan: 'pro',
        subscriptionStatus: 'active',
        planExpiresAt: null,
        hasSubscription: true,
        portalUrl: expect.stringContaining('lemonsqueezy.com'),
        checkoutUrls: {
          pro: expect.stringContaining('variant-pro-123'),
          team: expect.stringContaining('variant-team-456'),
        },
      });
    });

    it('should return null for non-existent org', async () => {
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue(null);
      const info = await service.getBillingInfo('missing-org');
      expect(info).toBeNull();
    });

    it('should return hasSubscription=false when no subscription', async () => {
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue({
        plan: 'free',
        lsCustomerId: null,
        lsSubscriptionId: null,
        lsSubscriptionStatus: null,
        planExpiresAt: null,
      });

      const info = await service.getBillingInfo('org-123');
      expect(info!.hasSubscription).toBe(false);
      expect(info!.portalUrl).toBeNull();
    });

    it('should include ISO date for planExpiresAt', async () => {
      const expiresAt = new Date('2026-04-01T00:00:00Z');
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue({
        plan: 'pro',
        lsCustomerId: 'cust-1',
        lsSubscriptionId: 'sub-1',
        lsSubscriptionStatus: 'cancelled',
        planExpiresAt: expiresAt,
      });

      const info = await service.getBillingInfo('org-123');
      expect(info!.planExpiresAt).toBe(expiresAt.toISOString());
    });
  });
});
