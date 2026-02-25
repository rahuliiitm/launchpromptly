import { Module } from '@nestjs/common';
import { PromptController } from './prompt.controller';
import { PromptResolveController } from './prompt-resolve.controller';
import { PromptService } from './prompt.service';
import { ProjectModule } from '../project/project.module';
import { TeamModule } from '../team/team.module';

@Module({
  imports: [ProjectModule, TeamModule],
  controllers: [PromptController, PromptResolveController],
  providers: [PromptService],
  exports: [PromptService],
})
export class PromptModule {}
