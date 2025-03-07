import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
} from '@nestjs/websockets';
import { RagAgentService } from './rag-agent.service';

@WebSocketGateway()
export class RagAgentGateway {
  constructor(private readonly ragAgentService: RagAgentService) {}

  @SubscribeMessage('createRagAgent')
  create(@MessageBody() messageBody: any) {
    return 'Hello';
  }
}
