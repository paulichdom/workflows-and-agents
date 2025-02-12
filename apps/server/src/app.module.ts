import { Module } from '@nestjs/common';

import { AppService } from './app.service';
import { AppController } from './app.controller';
import { ConfigModule } from '@nestjs/config';
import { WorkflowModule } from './workflow/workflow.module';
import { VercelAiSdkModule } from './vercel-ai-sdk/vercel-ai-sdk.module';
import { StreamModule } from './stream/stream.module';

@Module({
  imports: [ConfigModule.forRoot(), WorkflowModule, VercelAiSdkModule, StreamModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
