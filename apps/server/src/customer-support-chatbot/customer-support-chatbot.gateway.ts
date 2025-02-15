import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
} from '@nestjs/websockets';
import { CustomerSupportChatbotService } from './customer-support-chatbot.service';
import { HumanMessage } from '@langchain/core/messages';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: 'customer-support',
  transports: ['websocket', 'polling'],
})
export class CustomerSupportChatbotGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(CustomerSupportChatbotGateway.name);

  constructor(
    private readonly customerSupportChatbotService: CustomerSupportChatbotService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    client.emit('connected', { status: 'Connected to customer support chatbot' });
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('customer-support-chatbot')
  async handleMessage(
    @MessageBody() data: any,
    @ConnectedSocket() client: Socket,
  ) {
    this.logger.debug(`Message received from ${client.id}:`, data);
    
    // Handle both string messages and object messages
    const message = typeof data === 'string' ? data : data?.message || data?.data;
    
    if (!message) {
      const errorResponse = {
        error: 'No message provided',
      };
      this.logger.error('No message provided in request');
      client.emit('error', errorResponse);
      return errorResponse;
    }

    try {
      this.logger.debug('Creating graph...');
      const graph = await this.customerSupportChatbotService.graph();
      
      this.logger.debug('Invoking graph with message:', message);
      const result = await graph.invoke({
        messages: [new HumanMessage(message)],
        nextRepresentative: null,
        refundAuthorized: false,
      });

      this.logger.debug('Got result from graph:', result);

      // Emit to the sender
      client.emit('response', result.messages);
      
      // For debugging, also emit a simple message
      client.emit('debug', { 
        status: 'Message processed',
        originalMessage: message,
        hasResponse: !!result.messages 
      });

      return result.messages;
    } catch (error) {
      this.logger.error('Error in customer support chatbot:', error instanceof Error ? error.stack : error);
      const errorResponse = {
        error: 'An error occurred while processing your message',
        details: error instanceof Error ? error.message : String(error),
      };
      client.emit('error', errorResponse);
      return errorResponse;
    }
  }

  @SubscribeMessage('typing')
  handleTyping(
    @MessageBody() isTyping: boolean,
    @ConnectedSocket() client: Socket,
  ) {
    this.logger.debug(`Client ${client.id} typing status: ${isTyping}`);
    client.broadcast.emit(isTyping ? 'userTyping' : 'userStoppedTyping', {
      clientId: client.id,
    });
  }
}
