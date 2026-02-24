import { Module } from '@nestjs/common';
import { ProviderKeyController } from './provider-key.controller';
import { ProviderKeyService } from './provider-key.service';

@Module({
  controllers: [ProviderKeyController],
  providers: [ProviderKeyService],
  exports: [ProviderKeyService],
})
export class ProviderKeyModule {}
