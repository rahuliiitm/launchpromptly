import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { SnapshotModule } from './snapshot/snapshot.module';
import { ScenarioModule } from './scenario/scenario.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    SnapshotModule,
    ScenarioModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
