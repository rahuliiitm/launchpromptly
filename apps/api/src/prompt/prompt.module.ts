import { Module } from '@nestjs/common';
import { PromptController } from './prompt.controller';
import { PromptResolveController } from './prompt-resolve.controller';
import { PromptService } from './prompt.service';
import { ProjectModule } from '../project/project.module';

@Module({
  imports: [ProjectModule],
  controllers: [PromptController, PromptResolveController],
  providers: [PromptService],
  exports: [PromptService],
})
export class PromptModule {}
