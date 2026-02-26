import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { PlanTier } from '@launchpromptly/types';

/** Maps Lemon Squeezy variant IDs to plan tiers. Set in env. */
interface VariantMap {
  pro: string;
  team: string;
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly webhookSecret: string;
  private readonly storeId: string;
  private readonly variantMap: VariantMap;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.webhookSecret = this.config.get<string>('LS_WEBHOOK_SECRET', '');
    this.storeId = this.config.get<string>('LS_STORE_ID', '');
    this.variantMap = {
      pro: this.config.get<string>('LS_VARIANT_PRO', ''),
      team: this.config.get<string>('LS_VARIANT_TEAM', ''),
    };

    if (!this.storeId || !this.variantMap.pro || !this.variantMap.team) {
      this.logger.warn(
        'Billing not fully configured. Checkout URLs will be empty.\n' +
        '  → Set these in .env:\n' +
        '    LS_STORE_ID="your-store-slug" (from Lemon Squeezy → Settings → Store)\n' +
        '    LS_VARIANT_PRO="variant-id"   (from Products → Pro → Variants)\n' +
        '    LS_VARIANT_TEAM="variant-id"   (from Products → Team → Variants)\n' +
        '    LS_WEBHOOK_SECRET="secret"     (from Settings → Webhooks)',
      );
    }
  }

  getWebhookSecret(): string {
    return this.webhookSecret;
  }

  getStoreId(): string {
    return this.storeId;
  }

  /** Get Lemon Squeezy checkout URL for a plan */
  getCheckoutUrl(plan: 'pro' | 'team', organizationId: string): string {
    const variantId = this.variantMap[plan];
    if (!variantId || !this.storeId) {
      return '';
    }
    return `https://${this.storeId}.lemonsqueezy.com/checkout/buy/${variantId}?checkout[custom][org_id]=${organizationId}`;
  }

  /** Get Lemon Squeezy customer portal URL */
  getPortalUrl(lsCustomerId: string): string {
    return `https://app.lemonsqueezy.com/my-orders`;
  }

  /** Resolve variant ID to plan tier */
  private variantToPlan(variantId: string): PlanTier {
    if (variantId === this.variantMap.pro) return 'pro';
    if (variantId === this.variantMap.team) return 'business';
    return 'free';
  }

  /** Handle subscription_created or subscription_updated */
  async handleSubscriptionChange(data: {
    organizationId: string;
    customerId: string;
    subscriptionId: string;
    variantId: string;
    status: string;
    endsAt: string | null;
  }): Promise<void> {
    const { organizationId, customerId, subscriptionId, variantId, status, endsAt } = data;

    const plan = this.resolveplan(status, variantId);

    await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        plan,
        lsCustomerId: customerId,
        lsSubscriptionId: subscriptionId,
        lsSubscriptionStatus: status,
        lsVariantId: variantId,
        planExpiresAt: endsAt ? new Date(endsAt) : null,
      },
    });

    this.logger.log(
      `Updated org ${organizationId}: plan=${plan}, status=${status}, subscription=${subscriptionId}`,
    );
  }

  /** Handle subscription_cancelled — downgrade at period end */
  async handleSubscriptionCancelled(data: {
    organizationId: string;
    subscriptionId: string;
    endsAt: string | null;
  }): Promise<void> {
    const { organizationId, subscriptionId, endsAt } = data;

    // Keep current plan until endsAt, then cron or next webhook will downgrade
    await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        lsSubscriptionStatus: 'cancelled',
        planExpiresAt: endsAt ? new Date(endsAt) : null,
      },
    });

    this.logger.log(
      `Subscription cancelled for org ${organizationId}, active until ${endsAt ?? 'now'}`,
    );
  }

  /** Handle subscription_expired — immediate downgrade to free */
  async handleSubscriptionExpired(data: {
    organizationId: string;
    subscriptionId: string;
  }): Promise<void> {
    await this.prisma.organization.update({
      where: { id: data.organizationId },
      data: {
        plan: 'free',
        lsSubscriptionStatus: 'expired',
        planExpiresAt: null,
      },
    });

    this.logger.log(`Subscription expired for org ${data.organizationId}, downgraded to free`);
  }

  /** Get billing info for an organization */
  async getBillingInfo(organizationId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        plan: true,
        lsCustomerId: true,
        lsSubscriptionId: true,
        lsSubscriptionStatus: true,
        planExpiresAt: true,
      },
    });
    if (!org) return null;

    return {
      plan: org.plan as PlanTier,
      subscriptionStatus: org.lsSubscriptionStatus,
      planExpiresAt: org.planExpiresAt?.toISOString() ?? null,
      hasSubscription: !!org.lsSubscriptionId,
      portalUrl: org.lsCustomerId ? this.getPortalUrl(org.lsCustomerId) : null,
      checkoutUrls: {
        pro: this.getCheckoutUrl('pro', organizationId),
        team: this.getCheckoutUrl('team', organizationId),
      },
    };
  }

  /** Verify HMAC-SHA256 signature from Lemon Squeezy */
  verifySignature(body: string, signature: string): boolean {
    if (!this.webhookSecret) return false;
    const expected = createHmac('sha256', this.webhookSecret).update(body).digest('hex');
    return expected === signature;
  }

  /** Process a verified webhook event body. Returns { handled, error? } */
  async processWebhookEvent(body: Record<string, any>): Promise<{ handled: boolean; error?: string }> {
    const eventName = body?.meta?.event_name;
    const customData = body?.meta?.custom_data;
    const organizationId = customData?.org_id;

    if (!organizationId) {
      return { handled: false, error: 'no org_id in custom_data' };
    }

    const attrs = body?.data?.attributes;
    const subscriptionId = String(body?.data?.id ?? '');
    const customerId = String(attrs?.customer_id ?? '');
    const variantId = String(attrs?.variant_id ?? '');
    const status = attrs?.status ?? '';
    const endsAt = attrs?.ends_at ?? null;

    switch (eventName) {
      case 'subscription_created':
      case 'subscription_updated':
      case 'subscription_resumed':
        await this.handleSubscriptionChange({
          organizationId, customerId, subscriptionId, variantId, status, endsAt,
        });
        return { handled: true };

      case 'subscription_cancelled':
        await this.handleSubscriptionCancelled({ organizationId, subscriptionId, endsAt });
        return { handled: true };

      case 'subscription_expired':
        await this.handleSubscriptionExpired({ organizationId, subscriptionId });
        return { handled: true };

      default:
        this.logger.log(`Unhandled webhook event: ${eventName}`);
        return { handled: false };
    }
  }

  private resolveplan(status: string, variantId: string): PlanTier {
    if (status === 'active' || status === 'on_trial') {
      return this.variantToPlan(variantId);
    }
    // past_due — keep plan but flag
    if (status === 'past_due') {
      return this.variantToPlan(variantId);
    }
    return 'free';
  }
}
