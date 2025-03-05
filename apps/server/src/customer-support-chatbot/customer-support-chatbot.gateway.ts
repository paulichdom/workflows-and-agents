import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
  ConnectedSocket,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { CustomerSupportChatbotService } from './customer-support-chatbot.service';
import { HumanMessage } from '@langchain/core/messages';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: 'customer-support',
})
export class CustomerSupportChatbotGateway implements OnGatewayConnection {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(CustomerSupportChatbotGateway.name);

  constructor(
    private readonly customerSupportChatbotService: CustomerSupportChatbotService,
  ) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  @SubscribeMessage('chat')
  async handleMessage(
    @MessageBody() payload: any,
    @ConnectedSocket() client: Socket,
  ) {
    this.logger.log(`Received raw payload:`, payload);

    // Extract message from payload
    const message = payload?.data?.message || payload?.message;
    
    if (!message) {
      const errorMsg = 'No message provided in payload';
      this.logger.error(errorMsg);
      client.emit('error', { message: errorMsg });
      return;
    }

    this.logger.log(`Processing message from client ${client.id}: ${message}`);

    try {
      this.logger.log('Creating graph...');
      const graph = await this.customerSupportChatbotService.graph();
      this.logger.log('Graph created successfully');
      
      // Generate a unique thread ID for this conversation
      const threadId = uuidv4();
      this.logger.log(`Created thread ID: ${threadId}`);

      this.logger.log('Initializing stream...');
      const stream = await graph.stream({
        messages: [
          {
            role: 'user',
            content: message,
          }
        ],
        nextRepresentative: null,
        refundAuthorized: false,
      }, {
        configurable: {
          thread_id: threadId,
        }
      });
      this.logger.log('Stream initialized successfully');

      let stepCount = 0;
      // Stream each response to the client
      for await (const step of stream) {
        stepCount++;
        this.logger.log(`Emitting step ${stepCount}:`, step);
        client.emit('response', {
          threadId,
          step,
          stepCount
        });
      }
      this.logger.log(`Stream completed. Total steps: ${stepCount}`);

    } catch (error) {
      this.logger.error('Chat error:', error);
      this.logger.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      client.emit('error', { 
        message: 'Failed to process message',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }
}
