import { Module } from '@nestjs/common';
import { CustomerSupportChatbotService } from './customer-support-chatbot.service';
import { CustomerSupportChatbotGateway } from './customer-support-chatbot.gateway';

@Module({
  providers: [CustomerSupportChatbotGateway, CustomerSupportChatbotService],
})
export class CustomerSupportChatbotModule {}
