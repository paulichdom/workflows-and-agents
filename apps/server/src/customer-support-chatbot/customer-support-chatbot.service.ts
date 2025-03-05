import { Injectable, Logger } from '@nestjs/common';
import { ChatTogetherAI } from '@langchain/community/chat_models/togetherai';
import { BaseMessage, isAIMessage } from '@langchain/core/messages';
import {
  Annotation,
  MemorySaver,
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

type RepresentativeTypeKeys = keyof typeof RepresentativeType;

@Injectable()
export class CustomerSupportChatbotService {
  private readonly model: ChatTogetherAI;
  private readonly logger = new Logger(CustomerSupportChatbotService.name);

  constructor() {
    this.model = new ChatTogetherAI({
      model: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
      temperature: 0,
    });
  }

  private StateAnnotation = Annotation.Root({
    ...MessagesAnnotation.spec,
    nextRepresentative: Annotation<RepresentativeTypeKeys>,
    refundAuthorized: Annotation<boolean>,
  });

  async graph() {
    const checkpointer = new MemorySaver();

    return new StateGraph(this.StateAnnotation)
      .addNode('initial_support', this.initialSupport)
      .addNode('billing_support', this.billingSupport)
      .addNode('technical_support', this.technicalSupport)
      .addNode('handle_refund', this.handleRefund)
      .addEdge('__start__', 'initial_support')
      .addConditionalEdges(
        'initial_support',
        async (state) => {
          this.logger.log('Routing state:', state);
          
          switch (state.nextRepresentative) {
            case 'BILLING':
              return 'billing';
            case 'TECHNICAL':
              return 'technical';
            default:
              return 'conversational';
          }
        },
        {
          billing: 'billing_support',
          technical: 'technical_support',
          conversational: '__end__',
        },
      )
      .addEdge('technical_support', '__end__')
      .addConditionalEdges(
        'billing_support',
        async (state) => {
          return state.nextRepresentative === 'REFUND' ? 'refund' : 'end';
        },
        {
          refund: 'handle_refund',
          end: '__end__',
        },
      )
      .addEdge('handle_refund', '__end__')
      .compile({ checkpointer });
  };

  initialSupport = async (state: typeof this.StateAnnotation.State) => {
    console.log('State received in initialSupport:', state);
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

    const categorizationOutput = JSON.parse(
      categorizationResponse.content as string,
    );
    return {
      messages: [supportResponse],
      nextRepresentative: categorizationOutput.nextRepresentative,
    };
  };

  billingSupport = async (state: typeof this.StateAnnotation.State) => {
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
  };

  technicalSupport = async (state: typeof this.StateAnnotation.State) => {
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
  };

  handleRefund = async (state: typeof this.StateAnnotation.State) => {
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
  };

  private trimMessageHistory = (messages: BaseMessage[]): BaseMessage[] => {
    if (messages.at(-1) && isAIMessage(messages.at(-1))) {
      return messages.slice(0, -1);
    }
    return messages;
  };
}
