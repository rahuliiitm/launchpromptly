import {
  Controller,
  Post,
  Get,
  Req,
  Res,
  UseGuards,
  Logger,
  HttpCode,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { createHmac } from 'crypto';
import type { Request, Response } from 'express';
import { BillingService } from './billing.service';

@Controller('billing')
export class BillingController {
  private readonly logger = new Logger(BillingController.name);

  constructor(private readonly billingService: BillingService) {}

  /**
   * Lemon Squeezy webhook endpoint.
   * Verifies HMAC signature, then dispatches to billing service.
   */
  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(@Req() req: Request, @Res() res: Response) {
    const secret = this.billingService.getWebhookSecret();
    if (!secret) {
      this.logger.warn('LS_WEBHOOK_SECRET not configured, rejecting webhook');
      return res.status(500).json({ error: 'Webhook not configured' });
    }

    // Verify signature
    const signature = req.headers['x-signature'] as string;
    if (!signature) {
      return res.status(401).json({ error: 'Missing signature' });
    }

    const rawBody = (req as any).rawBody as Buffer | undefined;
    if (!rawBody) {
      // Fallback: stringify body
      const bodyStr = JSON.stringify(req.body);
      const hmac = createHmac('sha256', secret).update(bodyStr).digest('hex');
      if (hmac !== signature) {
        this.logger.warn('Webhook signature mismatch');
        return res.status(401).json({ error: 'Invalid signature' });
      }
    } else {
      const hmac = createHmac('sha256', secret).update(rawBody).digest('hex');
      if (hmac !== signature) {
        this.logger.warn('Webhook signature mismatch');
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    const body = req.body;
    const eventName = body?.meta?.event_name;
    const customData = body?.meta?.custom_data;
    const organizationId = customData?.org_id;

    if (!organizationId) {
      this.logger.warn(`Webhook ${eventName}: no org_id in custom_data`);
      return res.json({ received: true });
    }

    const attrs = body?.data?.attributes;
    const subscriptionId = String(body?.data?.id ?? '');
    const customerId = String(attrs?.customer_id ?? '');
    const variantId = String(attrs?.variant_id ?? '');
    const status = attrs?.status ?? '';
    const endsAt = attrs?.ends_at ?? null;

    try {
      switch (eventName) {
        case 'subscription_created':
        case 'subscription_updated':
        case 'subscription_resumed':
          await this.billingService.handleSubscriptionChange({
            organizationId,
            customerId,
            subscriptionId,
            variantId,
            status,
            endsAt,
          });
          break;

        case 'subscription_cancelled':
          await this.billingService.handleSubscriptionCancelled({
            organizationId,
            subscriptionId,
            endsAt,
          });
          break;

        case 'subscription_expired':
          await this.billingService.handleSubscriptionExpired({
            organizationId,
            subscriptionId,
          });
          break;

        default:
          this.logger.log(`Unhandled webhook event: ${eventName}`);
      }
    } catch (err) {
      this.logger.error(`Webhook processing error: ${(err as Error).message}`);
    }

    return res.json({ received: true });
  }

  /**
   * Get billing info for the authenticated user's organization.
   */
  @UseGuards(AuthGuard('jwt'))
  @Get('info')
  async getBillingInfo(@Req() req: Request) {
    const user = req.user as { organizationId: string };
    const info = await this.billingService.getBillingInfo(user.organizationId);
    return info ?? { plan: 'free', hasSubscription: false, checkoutUrls: { pro: '', team: '' } };
  }
}
