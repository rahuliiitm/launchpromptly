import { Module } from '@nestjs/common';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { ApiKeyGuard } from '../auth/api-key.guard';

@Module({
  controllers: [EventsController],
  providers: [EventsService, ApiKeyGuard],
})
export class EventsModule {}
