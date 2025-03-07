import { CheerioWebBaseLoader } from '@langchain/community/document_loaders/web/cheerio';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { OpenAIEmbeddings } from '@langchain/openai';
import { Document } from '@langchain/core/documents';

export class Retriever {
  private docsList: Document[] = [];
  private textSplitter: RecursiveCharacterTextSplitter;
  private docSplits: Document[] = [];
  private vectorStore: MemoryVectorStore;

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
      new OpenAIEmbeddings()
    )
  }

  private async getDocs() {
    return await Promise.all(
      Retriever.urls.map((url) => new CheerioWebBaseLoader(url).load()),
    );
  }
}
