import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { ChatAnthropic } from '@langchain/anthropic';
import { StateGraph, Annotation } from '@langchain/langgraph';
import { tool } from '@langchain/core/tools';

@Injectable()
export class WorkflowService {
  llm = new ChatAnthropic({
    model: 'claude-3-5-sonnet-latest',
  });

  /**
   * The Augmented LLM
   * LLM have augmentations that support building workflows and agents.
   * These include structured outputs and tool calling
   * @returns
   */
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

    console.log({ output });

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

  async promptChain() {
    const StateAnnotation = Annotation.Root({
      topic: Annotation<string>,
      joke: Annotation<string>,
      improvedJoke: Annotation<string>,
      finalJoke: Annotation<string>,
    });

    // Define node functions

    // First LLM call to generate initial joke
    const generateJoke = async (state: typeof StateAnnotation.State) => {
      const msg = await this.llm.invoke(
        `Write a short joke about ${state.topic}`,
      );
      return { joke: msg.content };
    };

    // Gate function to check if the joke has a punchline
    const checkPunchline = (state: typeof StateAnnotation.State) => {
      // Simple check - does the joke contain "?" or "!"
      if (state.joke?.includes('?') || state.joke?.includes('!')) {
        return 'Pass';
      }
      return 'Fail';
    };

    // Second LLM call to improve the joke
    const improveJoke = async (state: typeof StateAnnotation.State) => {
      const msg = await this.llm.invoke(
        `Make this joke funnier by adding wordplay: ${state.joke}`,
      );

      return { improvedJoke: msg.content };
    };

    // Third LLM call for final polish
    const polishJoke = async (state: typeof StateAnnotation.State) => {
      const msg = await this.llm.invoke(
        `Add a surprising twist to this joke: ${state.improvedJoke}`,
      );

      return { finalJoke: msg.content };
    };

    // Build workflow
    const chain = new StateGraph(StateAnnotation)
      .addNode('generateJoke', generateJoke)
      .addNode('improveJoke', improveJoke)
      .addNode('polishJoke', polishJoke)
      .addEdge('__start__', 'generateJoke')
      .addConditionalEdges('generateJoke', checkPunchline, {
        Pass: 'improveJoke',
        End: '__end__',
      })
      .addEdge('improveJoke', 'polishJoke')
      .addEdge('polishJoke', '__end__')
      .compile();

    // Invoke
    const state = await chain.invoke({ topic: 'cats' });

    return state;
  }
}
