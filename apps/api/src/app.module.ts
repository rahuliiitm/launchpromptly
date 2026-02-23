import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ProjectModule } from './project/project.module';
import { EventsModule } from './events/events.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { SnapshotModule } from './snapshot/snapshot.module';
import { AdvisoryModule } from './advisory/advisory.module';
import { ScenarioModule } from './scenario/scenario.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    ProjectModule,
    EventsModule,
    AnalyticsModule,
    SnapshotModule,
    AdvisoryModule,
    ScenarioModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
