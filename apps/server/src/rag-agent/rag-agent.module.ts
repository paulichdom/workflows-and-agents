import { Module } from '@nestjs/common';
import { RagAgentService } from './rag-agent.service';
import { RagAgentGateway } from './rag-agent.gateway';

@Module({
  providers: [RagAgentGateway, RagAgentService],
})
export class RagAgentModule {}
