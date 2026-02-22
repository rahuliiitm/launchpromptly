import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { SnapshotService } from './snapshot.service';
import { CreateSnapshotDto } from './dto/create-snapshot.dto';
import { CompareSnapshotsDto } from './dto/compare-snapshots.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('scenario/snapshots')
export class SnapshotCompareController {
  constructor(private readonly snapshotService: SnapshotService) {}

  @Post('compare')
  @UseGuards(JwtAuthGuard)
  async compare(@Body() dto: CompareSnapshotsDto) {
    return this.snapshotService.compare(dto.snapshotIds);
  }
}

@Controller('scenario')
export class SnapshotController {
  constructor(private readonly snapshotService: SnapshotService) {}

  @Post(':id/snapshots')
  @UseGuards(JwtAuthGuard)
  async create(@Param('id') id: string, @Body() dto: CreateSnapshotDto) {
    return this.snapshotService.create(id, dto);
  }

  @Get(':id/snapshots')
  @UseGuards(JwtAuthGuard)
  async list(@Param('id') id: string) {
    return this.snapshotService.listByScenario(id);
  }
}
