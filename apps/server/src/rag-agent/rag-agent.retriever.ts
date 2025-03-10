import { CheerioWebBaseLoader } from '@langchain/community/document_loaders/web/cheerio';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { OpenAIEmbeddings } from '@langchain/openai';
import { Document } from '@langchain/core/documents';
import { VectorStoreRetriever } from '@langchain/core/vectorstores';
import { Annotation } from '@langchain/langgraph';
import { BaseMessage } from '@langchain/core/messages';
import { createRetrieverTool } from 'langchain/tools/retriever';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { ZodObject, ZodString, ZodTypeAny } from 'zod';

export class Retriever {
  private GraphState = Annotation.Root({
    messages: Annotation<BaseMessage[]>({
      reducer: (x, y) => x.concat(y),
      default: () => [],
    }),
  });

  private docsList: Document[] = [];
  private textSplitter: RecursiveCharacterTextSplitter;
  private docSplits: Document[] = [];
  private vectorStore: MemoryVectorStore;
  private retriever: VectorStoreRetriever;

  private tools: DynamicStructuredTool<
    ZodObject<
      {
        query: ZodString;
      },
      'strip',
      ZodTypeAny,
      {
        query: string;
      },
      {
        query: string;
      }
    >
  >[];
  private toolNode: ToolNode<typeof this.GraphState.State>;

  private static urls = [
    'https://lilianweng.github.io/posts/2023-06-23-agent/',
    'https://lilianweng.github.io/posts/2023-03-15-prompt-engineering/',
    'https://lilianweng.github.io/posts/2023-10-25-adv-attack-llm/',
  ];

  constructor() {
    this.initialize();
  }

  private async initialize() {
    const docs = await this.getDocs();
    this.docsList = docs.flat();

    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 500,
      chunkOverlap: 50,
    });
    this.docSplits = await this.textSplitter.splitDocuments(this.docsList);

    // Add to vectorDB
    this.vectorStore = await MemoryVectorStore.fromDocuments(
      this.docSplits,
      new OpenAIEmbeddings(),
    );

    this.retriever = this.vectorStore.asRetriever();

    const tool = createRetrieverTool(this.retriever, {
      name: 'retrieve_blog_posts',
      description:
        'Search and return information about Lilian Weng blog posts on LLM agents, prompt engineering, and adversarial attacks on LLMs.',
    });

    this.tools = [tool];
    this.toolNode = new ToolNode<typeof this.GraphState.State>(this.tools);
  }

  private async getDocs() {
    return await Promise.all(
      Retriever.urls.map((url) => new CheerioWebBaseLoader(url).load()),
    );
  }
}
