import { Module, forwardRef } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { EvalModule } from '../eval/eval.module';

@Module({
  imports: [forwardRef(() => EvalModule)],
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
