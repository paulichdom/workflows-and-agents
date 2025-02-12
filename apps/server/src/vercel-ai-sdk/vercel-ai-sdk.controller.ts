import { Controller } from '@nestjs/common';
import { VercelAiSdkService } from './vercel-ai-sdk.service';

@Controller('vercel-ai-sdk')
export class VercelAiSdkController {
  constructor(private readonly vercelAiSdkService: VercelAiSdkService) {}
}
