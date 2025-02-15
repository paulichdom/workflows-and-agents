import { Injectable } from '@nestjs/common';
import { ChatTogetherAI } from '@langchain/community/chat_models/togetherai';
import { BaseMessage, isAIMessage } from '@langchain/core/messages';
import {
  Annotation,
  MessagesAnnotation,
  NodeInterrupt,
  StateGraph,
} from '@langchain/langgraph';
import { RoleTemplates } from './role.templates';
import zodToJsonSchema from 'zod-to-json-schema';
import { z } from 'zod';

const RepresentativeType = {
  BILLING: 'BILLING',
  TECHNICAL: 'TECHNICAL',
  REFUND: 'REFUND',
  RESPOND: 'RESPOND',
} as const;

@Injectable()
export class CustomerSupportChatbotService {
  private readonly model: ChatTogetherAI;

  constructor() {
    this.model = new ChatTogetherAI({
      model: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
      temperature: 0,
    });
  }

  private StateAnnotation = Annotation.Root({
    ...MessagesAnnotation.spec,
    nextRepresentative: Annotation<keyof typeof RepresentativeType>,
    refundAuthorized: Annotation<boolean>,
  });

  async graph() {
    return new StateGraph(this.StateAnnotation)
      .addNode('initial_support', this.initialSupport)
      .addNode('billing_support', this.billingSupport)
      .addNode('technical_support', this.technicalSupport)
      .addNode('handle_refund', this.handleRefund)
      .addEdge('__start__', 'initial_support')
      .compile();
  }

  async initialSupport(state: typeof this.StateAnnotation.State) {
    const supportResponse = await this.model.invoke([
      {
        role: 'system',
        content: RoleTemplates.INITIAL_SUPPORT_SYSTEM_TEMPLATE,
      },
      ...state.messages,
    ]);

    const categorizationResponse = await this.model.invoke(
      [
        {
          role: 'system',
          content: RoleTemplates.INITIAL_SUPPORT_CATEGORIZATION_SYSTEM_TEMPLATE,
        },
        ...state.messages,
        {
          role: 'user',
          content: RoleTemplates.INITIAL_SUPPORT_CATEGORIZATION_HUMAN_TEMPLATE,
        },
      ],
      {
        response_format: {
          type: 'json_object',
          schema: zodToJsonSchema(
            z.object({
              nextRepresentative: z.enum(['BILLING', 'TECHNICAL', 'RESPOND']),
            }),
          ),
        },
      },
    );

    // Some chat models can return complex content, but Together will not
    const categorizationOutput = JSON.parse(
      categorizationResponse.content as string,
    );
    // Will append the response message to the current interaction state
    return {
      messages: [supportResponse],
      nextRepresentative: categorizationOutput.nextRepresentative,
    };
  }

  async billingSupport(state: typeof this.StateAnnotation.State) {
    const trimmedHistory = this.trimMessageHistory(state.messages);

    const billingRepResponse = await this.model.invoke([
      {
        role: 'system',
        content: RoleTemplates.BILLING_SUPPORT_SYSTEM_TEMPLATE,
      },
      ...trimmedHistory,
    ]);

    const categorizationResponse = await this.model.invoke(
      [
        {
          role: 'system',
          content: RoleTemplates.BILLING_SUPPORT_CATEGORIZATION_SYSTEM_TEMPLATE,
        },
        {
          role: 'user',
          content: RoleTemplates.BILLING_SUPPORT_CATEGORIZATION_HUMAN_TEMPLATE(
            billingRepResponse.content,
          ),
        },
      ],
      {
        response_format: {
          type: 'json_object',
          schema: zodToJsonSchema(
            z.object({
              nextRepresentative: z.enum(['REFUND', 'RESPOND']),
            }),
          ),
        },
      },
    );

    const categorizationOutput = JSON.parse(
      categorizationResponse.content as string,
    );
    return {
      messages: billingRepResponse,
      nextRepresentative: categorizationOutput.nextRepresentative,
    };
  }

  async technicalSupport(state: typeof this.StateAnnotation.State) {
    const trimmedHistory = this.trimMessageHistory(state.messages);

    const response = await this.model.invoke([
      {
        role: 'system',
        content: RoleTemplates.TEHNICAL_SUPPORT_SYSTEM_TEMPLATE,
      },
      ...trimmedHistory,
    ]);

    return {
      messages: response,
    };
  }

  async handleRefund(state: typeof this.StateAnnotation.State) {
    if (!state.refundAuthorized) {
      console.log('--- HUMAN AUTHORIZATION REQUIRED FOR REFUND ---');
      throw new NodeInterrupt('Human authorization required.');
    }
    return {
      messages: {
        role: 'assistant',
        content: 'Refund processed!',
      },
    };
  }

  private trimMessageHistory(messages: BaseMessage[]): BaseMessage[] {
    if (messages.at(-1) && isAIMessage(messages.at(-1))) {
      return messages.slice(0, -1);
    }
    return messages;
  }

}
