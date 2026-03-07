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
import type { Request, Response } from 'express';
import { BillingService } from './billing.service';
import { UsageService } from './usage.service';

@Controller('billing')
export class BillingController {
  private readonly logger = new Logger(BillingController.name);

  constructor(
    private readonly billingService: BillingService,
    private readonly usageService: UsageService,
  ) {}

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
      return res.status(500).json({
        error: 'Billing webhook not configured',
        setup: 'Add LS_WEBHOOK_SECRET to your .env file. Get it from Lemon Squeezy → Settings → Webhooks.',
      });
    }

    // Verify signature
    const signature = req.headers['x-signature'] as string;
    if (!signature) {
      return res.status(401).json({ error: 'Missing signature' });
    }

    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    const bodyStr = rawBody ? rawBody.toString('utf8') : JSON.stringify(req.body);

    if (!this.billingService.verifySignature(bodyStr, signature)) {
      this.logger.warn('Webhook signature mismatch');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    try {
      await this.billingService.processWebhookEvent(req.body);
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
    return {
      ...(info ?? { plan: 'free', hasSubscription: false, checkoutUrls: { pro: '', team: '' } }),
    };
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('usage')
  async getUsage(@Req() req: Request) {
    const user = req.user as { organizationId: string };
    return this.usageService.getMonthlyUsage(user.organizationId);
  }
}
