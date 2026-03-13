import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validate } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ProjectModule } from './project/project.module';
import { EventsModule } from './events/events.module';
import { CryptoModule } from './crypto/crypto.module';
import { ProviderKeyModule } from './provider-key/provider-key.module';
import { InvitationModule } from './invitation/invitation.module';
import { BillingModule } from './billing/billing.module';
import { EnvironmentModule } from './environment/environment.module';
import { AuditModule } from './audit/audit.module';
import { AlertModule } from './alert/alert.module';
import { FeedbackModule } from './feedback/feedback.module';
import { SecurityPolicyModule } from './security-policy/security-policy.module';
import { SecurityAnalyticsModule } from './security-analytics/security-analytics.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,   // 1 second window
        limit: 20,   // 20 requests per second per IP
      },
      {
        name: 'medium',
        ttl: 60000,  // 1 minute window
        limit: 200,  // 200 requests per minute per IP
      },
    ]),
    PrismaModule,
    CryptoModule,
    AuthModule,
    ProjectModule,
    EventsModule,
    ProviderKeyModule,
    InvitationModule,
    BillingModule,
    EnvironmentModule,
    AuditModule,
    AlertModule,
    FeedbackModule,
    SecurityPolicyModule,
    SecurityAnalyticsModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
