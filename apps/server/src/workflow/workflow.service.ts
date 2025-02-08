import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { ChatAnthropic } from '@langchain/anthropic';
import { tool } from '@langchain/core/tools';

@Injectable()
export class WorkflowService {
  llm = new ChatAnthropic({
    model: 'claude-3-5-sonnet-latest',
  });

  async augmentedLLM() {
    const searchQuerySchema = z.object({
      searchQuery: z.string().describe('Query that is optimized web search.'),
      justification: z
        .string()
        .describe("Why this query is relevant to the user's request."),
    });

    // Augment the LLM with schema for structured output
    const structuredLLM = this.llm.withStructuredOutput(searchQuerySchema, {
      name: 'searchQuery',
    });

    // Invoke the augmented LLM
    const output = await structuredLLM.invoke(
      'How does Calcium CT score relate to high cholesterol?',
    );

    const multiply = tool(
      ({ a, b }) => {
        return a * b;
      },
      {
        name: 'multiply',
        description: 'multiplies two numbers together',
        schema: z.object({
          a: z.number().describe('the first number'),
          b: z.number().describe('the second number'),
        }),
      },
    );

    // Augment the LLM with tools
    const llmWithTools = this.llm.bindTools([multiply]);

    // Invoke the LLM with input that triggers the tool call
    const message = await llmWithTools.invoke('What is 2 times 3');

    console.log(message.tool_calls);

    return { message };
  }
}
