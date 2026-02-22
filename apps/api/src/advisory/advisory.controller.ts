import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import { AdvisoryService } from './advisory.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('scenario')
export class AdvisoryController {
  constructor(private readonly advisoryService: AdvisoryService) {}

  @Post(':id/advisory')
  @UseGuards(JwtAuthGuard)
  async getAdvisory(@Param('id') id: string) {
    return this.advisoryService.generateInsight(id);
  }
}
