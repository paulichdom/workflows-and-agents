import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
} from '@nestjs/common';
import { WorkflowService } from './workflow.service';

@Controller('workflow')
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Get('augmented-llm')
  augmentedLLM() {
    return this.workflowService.augmentedLLM();
  }

  @Get('prompt-chain')
  promptChain() {
    return this.workflowService.promptChain();
  }

  @Get('parallelization')
  parallelization() {
    return this.workflowService.parallelization();
  }

  @Get('routing')
  routing(@Body() body: { input: string }) {
    return this.workflowService.routing(body.input);
  }

  @Get('orchestrator-worker')
  orchestratorWorker() {
    return this.workflowService.orchestratorWorker();
  }

  @Get('evaluator-optimizer')
  evaluatorOptimizer() {
    return this.workflowService.evaluatorOptimizer();
  }

  @Get('agent')
  agebt() {
    return this.workflowService.agent();
  }
}
