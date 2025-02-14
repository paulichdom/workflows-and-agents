import { Injectable } from '@nestjs/common';
import { ChatTogetherAI } from "@langchain/community/chat_models/togetherai";

@Injectable()
export class CustomerSupportChatbotService {
  model = new ChatTogetherAI({
    model: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
    temperature: 0
  })
}
