import { Module } from '@nestjs/common';
import { StreamService } from './stream.service';
import { StreamGateway } from './stream.gateway';

@Module({
  providers: [StreamGateway, StreamService],
})
export class StreamModule {}
