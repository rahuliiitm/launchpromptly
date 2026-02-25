import { Module } from '@nestjs/common';
import { EvalController } from './eval.controller';
import { EvalService } from './eval.service';
import { ProjectModule } from '../project/project.module';
import { TeamModule } from '../team/team.module';

@Module({
  imports: [ProjectModule, TeamModule],
  controllers: [EvalController],
  providers: [EvalService],
  exports: [EvalService],
})
export class EvalModule {}
