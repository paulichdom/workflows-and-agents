import { Module } from '@nestjs/common';
import { VercelAiSdkService } from './vercel-ai-sdk.service';
import { VercelAiSdkController } from './vercel-ai-sdk.controller';

@Module({
  controllers: [VercelAiSdkController],
  providers: [VercelAiSdkService],
})
export class VercelAiSdkModule {}
