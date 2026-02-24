import { Module } from '@nestjs/common';
import { PlaygroundController } from './playground.controller';
import { PlaygroundService } from './playground.service';
import { LlmGatewayService } from './llm-gateway.service';
import { ProviderKeyModule } from '../provider-key/provider-key.module';

@Module({
  imports: [ProviderKeyModule],
  controllers: [PlaygroundController],
  providers: [PlaygroundService, LlmGatewayService],
})
export class PlaygroundModule {}
