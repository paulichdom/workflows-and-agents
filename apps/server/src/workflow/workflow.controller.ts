import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { WorkflowService } from './workflow.service';


@Controller('workflow')
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Get('augmented-llm')
  augmentedLLM() {
    return this.workflowService.augmentedLLM()
  }

}
