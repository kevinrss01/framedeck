import { Module } from '@nestjs/common';
import { ToolsService } from './tools.service';
import { ToolsController } from './tools.controller';
import { RealtimeModule } from '../../realtime/realtime.module';
import { AudioModule } from '../../audio/audio.module';
import { TwelveLabsService } from '../../video-analysis/twelve-labs/twelve-labs.service';

@Module({
  imports: [RealtimeModule, AudioModule],
  controllers: [ToolsController],
  providers: [ToolsService, TwelveLabsService],
  exports: [ToolsService],
})
export class ToolsModule {}
