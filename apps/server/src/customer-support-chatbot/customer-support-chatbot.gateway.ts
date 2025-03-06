import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { CustomerSupportChatbotService } from './customer-support-chatbot.service';
import { HumanMessage } from '@langchain/core/messages';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/customer-support',
  transports: ['websocket', 'polling']
})
export class CustomerSupportChatbotGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
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
    // Send a message back to confirm connection
    this.server.emit('message', { 
      type: 'connection',
      content: `Connected to customer support chatbot. Client ID: ${client.id}`
    });
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  private extractMessageContent(step: any): { content: string; representative: string } {
    this.logger.debug('Extracting message content from step:', step);
    
    // Get the node name (e.g., 'initial_support', 'billing_support')
    const nodeName = Object.keys(step)[0];
    const nodeOutput = step[nodeName];

    // Extract the message content
    let content = '';
    if (Array.isArray(nodeOutput.messages)) {
      // Handle array of messages
      const message = nodeOutput.messages[0];
      content = message?.kwargs?.content || message?.content || '';
    } else if (nodeOutput.messages?.kwargs?.content) {
      // Handle single message with kwargs
      content = nodeOutput.messages.kwargs.content;
    } else if (nodeOutput.messages?.content) {
      // Handle single message without kwargs
      content = nodeOutput.messages.content;
    }

    const response = {
      content,
      representative: nodeName.replace('_', ' ').toUpperCase(),
    };

    this.logger.debug('Extracted response:', response);
    return response;
  }

  @SubscribeMessage('message')
  async handleMessage(
    @MessageBody() payload: any,
    @ConnectedSocket() client: Socket,
  ) {
    this.logger.log(`Received raw payload from ${client.id}:`, payload);

    // Extract message from payload, handling different formats
    let message = '';
    try {
      if (typeof payload === 'string') {
        const parsed = JSON.parse(payload);
        message = parsed?.data?.message || parsed?.message || parsed;
      } else {
        message = payload?.data?.message || payload?.message || payload;
      }
    } catch (e) {
      message = payload;
    }

    if (!message || typeof message !== 'string') {
      const errorMsg = 'Invalid or no message provided';
      this.logger.error(errorMsg);
      this.server.emit('message', { 
        type: 'error',
        content: errorMsg 
      });
      return;
    }

    this.logger.log(`Processing message from client ${client.id}: ${message}`);

    try {
      this.logger.log('Creating graph...');
      const graph = await this.customerSupportChatbotService.graph();
      this.logger.log('Graph created successfully');
      
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
        this.logger.log(`Processing step ${stepCount}:`, step);
        
        const response = this.extractMessageContent(step);
        const messageToSend = {
          type: 'response',
          threadId,
          stepCount,
          ...response
        };
        
        this.logger.log(`Emitting response to client ${client.id}:`, messageToSend);
        this.server.emit('message', messageToSend);
      }
      this.logger.log(`Stream completed. Total steps: ${stepCount}`);

      // Send completion notification
      this.server.emit('message', { 
        type: 'completed',
        threadId, 
        totalSteps: stepCount 
      });

    } catch (error) {
      this.logger.error('Chat error:', error);
      this.logger.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      this.server.emit('message', { 
        type: 'error',
        content: 'Failed to process message',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }
}
