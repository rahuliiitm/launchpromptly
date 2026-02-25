import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ProjectModule } from './project/project.module';
import { EventsModule } from './events/events.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { PromptModule } from './prompt/prompt.module';
import { CryptoModule } from './crypto/crypto.module';
import { ProviderKeyModule } from './provider-key/provider-key.module';
import { PlaygroundModule } from './playground/playground.module';
import { InvitationModule } from './invitation/invitation.module';
import { BillingModule } from './billing/billing.module';
import { EnvironmentModule } from './environment/environment.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    CryptoModule,
    AuthModule,
    ProjectModule,
    EventsModule,
    AnalyticsModule,
    PromptModule,
    ProviderKeyModule,
    PlaygroundModule,
    InvitationModule,
    BillingModule,
    EnvironmentModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
