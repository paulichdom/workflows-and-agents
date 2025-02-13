import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { ChatAnthropic } from '@langchain/anthropic';
import {
  StateGraph,
  Annotation,
  Send,
  MessagesAnnotation,
} from '@langchain/langgraph';
import { tool } from '@langchain/core/tools';
import { AIMessage, ToolMessage, HumanMessage, SystemMessage, BaseMessage } from '@langchain/core/messages';

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

    const multiply = tool(
      async ({ a, b }) => {
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

  /**
   * In the orchestrator-workers workflow, a central LLM dynamically breaks down tasks,
   * delegates them to worker LLMs, and synthesizes their results.
   */
  async orchestratorWorker() {
    const sectionSchema = z.object({
      name: z.string().describe('Name for this section of the report.'),
      description: z
        .string()
        .describe(
          'Brief overview of the main topics and concepts to be covered in this section.',
        ),
    });

    const sectionsSchema = z.object({
      sections: z.array(sectionSchema).describe('Sections of the report.'),
    });

    // Augment the LLM with schema for strucured output
    const planner = this.llm.withStructuredOutput(sectionsSchema);

    // Graph state
    const StateAnnotation = Annotation.Root({
      topic: Annotation<string>,
      sections: Annotation<Array<z.infer<typeof sectionSchema>>>,
      completedSections: Annotation<string[]>({
        default: () => [],
        reducer: (a, b) => a.concat(b),
      }),
      finalReport: Annotation<string>,
    });

    // Worker state
    const WorkerStateAnnotation = Annotation.Root({
      section: Annotation<z.infer<typeof sectionSchema>>,
      completedSections: Annotation<string[]>({
        default: () => [],
        reducer: (a, b) => a.concat(b),
      }),
    });

    // Nodes
    const orchestrator = async (state: typeof StateAnnotation.State) => {
      // Geneare queries
      const reportSections = await planner.invoke([
        { role: 'system', content: 'Generate a plan for the report.' },
        { role: 'user', content: `Here is the report topic: ${state.topic}` },
      ]);

      return { sections: reportSections.sections };
    };

    const llmCall = async (state: typeof WorkerStateAnnotation.State) => {
      // Generate section
      const section = await this.llm.invoke([
        {
          role: 'system',
          content:
            'Write a report section following the provided name and description. Include no preamble for each section. Use markdown formatting.',
        },
        {
          role: 'user',
          content: `Here is the section name: ${state.section.name} and description: ${state.section.description}`,
        },
      ]);

      // Write the updated section to completed sections
      return { completedSections: [section.content] };
    };

    const synthesizer = async (state: typeof StateAnnotation.State) => {
      // List  of completed sections
      const completedSections = state.completedSections;

      // Format completed section to str to use as context for final sections
      const completedReportSections = completedSections.join('\n\n---\n\n');

      return { finalReport: completedReportSections };
    };

    // Conditional edge function to create llm_call workers that each write a section of the report
    const assignWorkers = (state: typeof StateAnnotation.State) => {
      // Kick off section writing in parallel via Send() API
      return state.sections.map((section) => new Send('llmCall', { section }));
    };

    // Build workflow
    const orchestratorWorker = new StateGraph(StateAnnotation)
      .addNode('orchestrator', orchestrator)
      .addNode('llmCall', llmCall)
      .addNode('synthesizer', synthesizer)
      .addEdge('__start__', 'orchestrator')
      .addConditionalEdges('orchestrator', assignWorkers, ['llmCall'])
      .addEdge('llmCall', 'synthesizer')
      .addEdge('synthesizer', '__end__')
      .compile();

    // Invoke
    const state = await orchestratorWorker.invoke({
      topic: 'Create a report on LLM scaling laws',
    });

    console.log({ state });

    return state.finalReport;
  }

  /**
   * In the evaluator-optimizer workflow, one LLM call generates a response
   * while another provides evaluation and feedback in a loop.
   */
  async evaluatorOptimizer() {
    // Graph state
    const StateAnnotation = Annotation.Root({
      joke: Annotation<string>,
      topic: Annotation<string>,
      feedback: Annotation<string>,
      funnyOrNot: Annotation<string>,
    });

    const feedbackSchema = z.object({
      grade: z
        .enum(['funny', 'not funny'])
        .describe('Decide if the joke is funny or not.'),
      feedback: z
        .string()
        .describe(
          'If the joke is not funny, provide feedback on how to improve it.',
        ),
    });

    // Augment the LLM with schema for structured output
    const evaluator = this.llm.withStructuredOutput(feedbackSchema);

    // Nodes
    const llmCallGenerator = async (state: typeof StateAnnotation.State) => {
      // LLM generates a joke
      let msg;
      if (state.feedback) {
        msg = await this.llm.invoke(
          `Write a joke about ${state.topic} but take into account the feedback: ${state.feedback}`,
        );
      } else {
        msg = await this.llm.invoke(`Write a joke about ${state.topic}`);
      }

      return { joke: msg.content };
    };

    const llmCallEvaluator = async (state: typeof StateAnnotation.State) => {
      // LLM evaluates the joke
      const grade = await evaluator.invoke(`Grade the joke ${state.joke}`);
      return { funnyOrNot: grade.grade, feedback: grade.feedback };
    };

    // Conditional edge function to route back to joke generator or end based upon feedback from the evaluator
    const routeJoke = (state: typeof StateAnnotation.State) => {
      // Route back to joke generator or end based upon feedback from the evaluator
      if (state.funnyOrNot === 'funny') {
        return 'Accepted';
      } else if (state.funnyOrNot === 'not funny') {
        return 'Rejected + Feedback';
      }
    };

    // Build workflow
    const optimizerWorkflow = new StateGraph(StateAnnotation)
      .addNode('llmCallGenerator', llmCallGenerator)
      .addNode('llmCallEvaluator', llmCallEvaluator)
      .addEdge('__start__', 'llmCallGenerator')
      .addEdge('llmCallGenerator', 'llmCallEvaluator')
      .addConditionalEdges('llmCallEvaluator', routeJoke, {
        // Name returned by routeJoke : Name of next node to visit
        Accepted: '__end__',
        'Rejected + Feedback': 'llmCallGenerator',
      })
      .compile();

    const state = await optimizerWorkflow.invoke({ topic: 'Funrniture' });
    console.log(state.joke);

    return state;
  }

  /**
   * Agents can handle sophisticated tasks, but their implementation is often straightforward.
   * They are typically just LLMs using tools based on environmental feedback in a loop.
   */
  async agent() {
    // Define tools
    const multiply = tool(
      async ({ a, b }) => {
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

    const add = tool(
      async ({ a, b }) => {
        return a + b;
      },
      {
        name: 'add',
        description: 'Add two numbers together',
        schema: z.object({
          a: z.number().describe('first number'),
          b: z.number().describe('second number'),
        }),
      },
    );

    const divide = tool(
      async ({ a, b }) => {
        return a / b;
      },
      {
        name: 'divide',
        description: 'Divide two numbers',
        schema: z.object({
          a: z.number().describe('first number'),
          b: z.number().describe('second number'),
        }),
      },
    );

    // Augment the LLM with tools
    const tools = [add, multiply, divide];
    const toolsByName = Object.fromEntries(tools.map((tool) => [tool.name, tool]));
    const llmWithTools = this.llm.bindTools(tools);

    // Nodes
    const llmCall = async (state: typeof MessagesAnnotation.State) => {
      const systemMessage = new SystemMessage(
        'You are a helpful assistant tasked with performing arithmetic on a set of inputs.'
      );

      const ensureStringContent = (content: unknown): string => 
        typeof content === 'string' ? content : JSON.stringify(content);

      const createTypedMessage = (msg: BaseMessage) => {
        const content = ensureStringContent(msg.content);

        switch (true) {
          case msg instanceof AIMessage:
            return new AIMessage({
              content,
              tool_calls: (msg as AIMessage).tool_calls,
            });
          case msg instanceof ToolMessage:
            return new ToolMessage({
              content,
              tool_call_id: (msg as ToolMessage).tool_call_id,
            });
          case msg instanceof HumanMessage:
            return new HumanMessage({ content });
          default:
            return new HumanMessage({ content });
        }
      };

      const messages = state.messages.map(createTypedMessage);
      const result = await llmWithTools.invoke([systemMessage, ...messages]);

      return {
        messages: [result],
      };
    };

    const toolNode = async (state: typeof MessagesAnnotation.State) => {
      const results: ToolMessage[] = [];
      const lastMessage = state.messages.at(-1);

      if (lastMessage instanceof AIMessage && lastMessage?.tool_calls?.length) {
        for (const toolCall of lastMessage.tool_calls) {
          const tool = toolsByName[toolCall.name];
          const observation = await tool.invoke(toolCall.args);
          results.push(
            new ToolMessage({
              content: observation,
              tool_call_id: toolCall.id,
            }),
          );
        }
      }

      return { messages: results };
    };

    const shouldContinue = (state: typeof MessagesAnnotation.State) => {
      const messages = state.messages;
      const lastMessage = messages.at(-1);

      if (lastMessage instanceof AIMessage && lastMessage?.tool_calls?.length) {
        return 'Action';
      }
      return '__end__';
    };

    // Build workflow
    const agentBuilder = new StateGraph(MessagesAnnotation)
      .addNode('llmCall', llmCall)
      .addNode('tools', toolNode)
      .addEdge('__start__', 'llmCall')
      .addConditionalEdges('llmCall', shouldContinue, {
        Action: 'tools',
        __end__: '__end__',
      })
      .addEdge('tools', 'llmCall')
      .compile();

    // Invoke
    const messages = [
      new HumanMessage({
        content: 'Add 3 and 4.'
      })
    ];
    const result = await agentBuilder.invoke({ messages });

    return result.messages;
  }
}
