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

  /**
   * Prompt chaining
   *
   * Prompt chaining decomposes a task into a sequence of steps,
   * where each LLM call processes the output of the previous one.
   * You can add programmatic checks on any intermediate steps to
   * ensure that the process is still on track.
   * @returns
   */
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

  /**
   * Parallelization
   *
   * LLMs can sometimes work simultaneously on a task and have their outputs aggregated programmatically.
   * This workflow, parallelization, manifests in two key variations:
   *  - Sectioning: Breaking a task into independent subtasks run in parallel.
   *  - Voting: Running the same task multiple times to get diverse outputs.
   * @returns
   */
  async parallelization() {
    // Graph state
    const StateAnnotation = Annotation.Root({
      topic: Annotation<string>,
      joke: Annotation<string>,
      story: Annotation<string>,
      poem: Annotation<string>,
      combinedOutput: Annotation<string>,
    });

    // Nodes
    // First LLM call to generate initial joke
    const callLlm1 = async (state: typeof StateAnnotation.State) => {
      const msg = await this.llm.invoke(`Write a joke about ${state.topic}`);
      return { joke: msg.content };
    };

    // Second LLM call to generate story
    const callLlm2 = async (state: typeof StateAnnotation.State) => {
      const msg = await this.llm.invoke(`Write a story about ${state.topic}`);
      return { story: msg.content };
    };

    // Third LLM call to generate poem
    const callLlm3 = async (state: typeof StateAnnotation.State) => {
      const msg = await this.llm.invoke(`Write a poem about ${state.topic}`);
      return { poem: msg.content };
    };

    const aggregator = async (state: typeof StateAnnotation.State) => {
      const combined =
        `Here's a story, joke, and poem about ${state.topic}!\n\n` +
        `STORY:\n${state.story}\n\n` +
        `JOKE:\n${state.joke}\n\n` +
        `POEM:\n${state.poem}`;

      return { combinedOutput: combined };
    };

    // Build wokflow
    const parallelWorkflow = new StateGraph(StateAnnotation)
      .addNode('callLlm1', callLlm1)
      .addNode('callLlm2', callLlm2)
      .addNode('callLlm3', callLlm3)
      .addNode('aggregator', aggregator)
      .addEdge('__start__', 'callLlm1')
      .addEdge('__start__', 'callLlm2')
      .addEdge('__start__', 'callLlm3')
      .addEdge('callLlm1', 'aggregator')
      .addEdge('callLlm2', 'aggregator')
      .addEdge('callLlm3', 'aggregator')
      .addEdge('aggregator', '__end__')
      .compile();

    const result = await parallelWorkflow.invoke({ topic: 'cats' });

    return result;
  }

  /**
   * Routing classifies an input and directs it to a specialized followup task.
   * This workflow allows for separation of concerns, and building more specialized prompts.
   * Without this workflow, optimizing for one kind of input can hurt performance on other inputs.
   */
  async routing(input: string) {
    const routeSchema = z.object({
      step: z
        .enum(['poem', 'story', 'joke'])
        .describe('The next step in the routing process'),
    });

    // Augment the LLM with schema for strucured output
    const router = this.llm.withStructuredOutput(routeSchema);

    // Graph state
    const StateAnnotation = Annotation.Root({
      input: Annotation<string>,
      decision: Annotation<string>,
      output: Annotation<string>,
    });

    // Nodes
    // Write a story
    const llmCall1 = async (state: typeof StateAnnotation.State) => {
      const result = await this.llm.invoke([
        {
          role: 'system',
          content: 'You are an expert storyteller',
        },
        {
          role: 'user',
          content: state.input,
        },
      ]);

      return { output: result.content };
    };

    // Write a joke
    const llmCall2 = async (state: typeof StateAnnotation.State) => {
      const result = await this.llm.invoke([
        {
          role: 'system',
          content: 'You are an expert comedian.',
        },
        {
          role: 'user',
          content: state.input,
        },
      ]);
      return { output: result.content };
    };

    // Write a poem
    const llmCall3 = async (state: typeof StateAnnotation.State) => {
      const result = await this.llm.invoke([
        {
          role: 'system',
          content: 'You are an expert poet.',
        },
        {
          role: 'user',
          content: state.input,
        },
      ]);
      return { output: result.content };
    };

    const llmCallRouter = async (state: typeof StateAnnotation.State) => {
      // Route the input to the appropriate node
      const decision = await router.invoke([
        {
          role: 'system',
          content:
            "Route the input to story, joke, or poem based on the user's request.",
        },
        {
          role: 'user',
          content: state.input,
        },
      ]);

      return { decision: decision.step };
    };

    const routeDecision = async (state: typeof StateAnnotation.State) => {
      // Return the node name you want to visit next
      if (state.decision === 'story') {
        return 'llmCall1';
      } else if (state.decision === 'joke') {
        return 'llmCall2';
      } else if (state.decision === 'poem') {
        return 'llmCall3';
      }
    };

    // Build workflow
    const routerWorkflow = new StateGraph(StateAnnotation)
      .addNode('llmCall1', llmCall1)
      .addNode('llmCall2', llmCall2)
      .addNode('llmCall3', llmCall3)
      .addNode('llmCallRouter', llmCallRouter)
      .addEdge('__start__', 'llmCallRouter')
      .addConditionalEdges('llmCallRouter', routeDecision, [
        'llmCall1',
        'llmCall2',
        'llmCall3',
      ])
      .addEdge('llmCall1', '__end__')
      .addEdge('llmCall2', '__end__')
      .addEdge('llmCall3', '__end__')
      .compile();

    const state = await routerWorkflow.invoke({
      input,
    });

    return state;
  }
}
