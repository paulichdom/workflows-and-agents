import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
} from '@nestjs/websockets';
import { StreamService } from './stream.service';

@WebSocketGateway()
export class StreamGateway {
  constructor(private readonly streamService: StreamService) {}

  @SubscribeMessage('createStream')
  stream() {}
}
