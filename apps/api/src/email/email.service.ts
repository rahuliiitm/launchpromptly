import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null;
  private readonly from: string;
  private readonly appUrl: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    this.resend = apiKey ? new Resend(apiKey) : null;
    this.from = this.config.get<string>('EMAIL_FROM') ?? 'LaunchPromptly <noreply@launchpromptly.dev>';
    this.appUrl = this.config.get<string>('APP_URL') ?? 'http://localhost:3000';

    if (!this.resend) {
      this.logger.warn('RESEND_API_KEY not set — password reset emails will be logged to console only.');
    }
  }

  async sendAlertEmail(
    to: string,
    alertName: string,
    conditionType: string,
    eventSummary: Record<string, unknown>,
  ): Promise<void> {
    const dashboardUrl = `${this.appUrl}/admin/security/alerts`;
    const firedAt = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

    const summaryLines = Object.entries(eventSummary)
      .filter(([, v]) => v != null)
      .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#6B7280;font-size:13px;">${k}</td><td style="padding:4px 0;font-size:13px;font-weight:500;color:#111827;">${typeof v === 'object' ? JSON.stringify(v) : v}</td></tr>`)
      .join('');

    const subject = `[LaunchPromptly] Alert: ${alertName}`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
        <div style="background: #FEF3C7; border: 1px solid #F59E0B; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
          <h2 style="color: #92400E; margin: 0 0 4px 0; font-size: 16px;">Security Alert: ${alertName}</h2>
          <p style="color: #A16207; margin: 0; font-size: 13px;">Condition: <strong>${conditionType.replace(/_/g, ' ')}</strong> &middot; ${firedAt}</p>
        </div>
        <table style="width:100%;border-collapse:collapse;">${summaryLines}</table>
        <a href="${dashboardUrl}" style="display: inline-block; background: #2563EB; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 500; margin-top: 20px; font-size: 14px;">
          View Alert Rules
        </a>
        <p style="color: #9CA3AF; font-size: 12px; margin-top: 24px;">
          This alert was triggered by your LaunchPromptly security policy. You can adjust alert rules in the dashboard.
        </p>
      </div>
    `;

    if (this.resend) {
      await this.resend.emails.send({ from: this.from, to, subject, html });
      this.logger.log(`Alert email sent to ${to} for "${alertName}"`);
    } else {
      this.logger.log(`[DEV] Alert "${alertName}" (${conditionType}) would email ${to}: ${JSON.stringify(eventSummary)}`);
    }
  }

  async sendPasswordReset(email: string, token: string): Promise<void> {
    const resetUrl = `${this.appUrl}/reset-password?token=${token}`;

    const subject = 'Reset your LaunchPromptly password';
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #111827; margin-bottom: 16px;">Reset your password</h2>
        <p style="color: #6B7280; line-height: 1.6;">
          You requested a password reset for your LaunchPromptly account. Click the button below to set a new password.
          This link expires in 1 hour.
        </p>
        <a href="${resetUrl}" style="display: inline-block; background: #2563EB; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500; margin: 16px 0;">
          Reset Password
        </a>
        <p style="color: #9CA3AF; font-size: 13px; margin-top: 24px;">
          If you didn't request this, you can safely ignore this email.
        </p>
      </div>
    `;

    if (this.resend) {
      await this.resend.emails.send({ from: this.from, to: email, subject, html });
      this.logger.log(`Password reset email sent to ${email}`);
    } else {
      this.logger.log(`[DEV] Password reset link for ${email}: ${resetUrl}`);
    }
  }
}
