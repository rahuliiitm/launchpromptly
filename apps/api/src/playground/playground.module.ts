import { Module } from '@nestjs/common';
import { PlaygroundController } from './playground.controller';
import { PlaygroundService } from './playground.service';
import { LlmGatewayService } from './llm-gateway.service';
import { ProviderKeyModule } from '../provider-key/provider-key.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [ProviderKeyModule, BillingModule],
  controllers: [PlaygroundController],
  providers: [PlaygroundService, LlmGatewayService],
})
export class PlaygroundModule {}
