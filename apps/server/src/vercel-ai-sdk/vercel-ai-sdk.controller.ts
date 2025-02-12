import { Controller, Post, Res } from '@nestjs/common';
import { VercelAiSdkService } from './vercel-ai-sdk.service';
import { Response } from 'express';
import { pipeDataStreamToResponse, streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';

@Controller('vercel-ai-sdk')
export class VercelAiSdkController {
  constructor(private readonly vercelAiSdkService: VercelAiSdkService) {}

  @Post('example')
  async example(@Res() res: Response) {
    const result = streamText({
      model: anthropic('claude-3-haiku-20240307'),
      prompt: 'Invent a new holiday and describe its traditions.',
    });

    result.pipeDataStreamToResponse(res)
  }

  @Post('/stream-data')
  async streamData(@Res() res: Response) {
    pipeDataStreamToResponse(res, {
      execute: async dataStreamWriter => {
        dataStreamWriter.writeData('initialized call');

        const result = streamText({
          model: anthropic('claude-3-haiku-20240307'),
          prompt: 'Invent a new holiday and describe its traditions.',
        });

        result.mergeIntoDataStream(dataStreamWriter);
      },
      onError: error => {
        // Error messages are masked by default for security reasons.
        // If you want to expose the error message to the client, you can do so here:
        return error instanceof Error ? error.message : String(error);
      },
    });
  }
}
