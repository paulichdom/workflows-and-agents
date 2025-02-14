import { WebSocketGateway, SubscribeMessage, MessageBody } from '@nestjs/websockets';
import { CustomerSupportChatbotService } from './customer-support-chatbot.service';

@WebSocketGateway()
export class CustomerSupportChatbotGateway {
  constructor(private readonly customerSupportChatbotService: CustomerSupportChatbotService) {}

  @SubscribeMessage('customer-support-chatbot')
  stream() {
    return null;
  }

}
