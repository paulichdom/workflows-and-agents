import { Module } from '@nestjs/common';

import { AppService } from './app.service';
import { AppController } from './app.controller';
import { ConfigModule } from '@nestjs/config';
import { WorkflowModule } from './workflow/workflow.module';

@Module({
  imports: [ConfigModule.forRoot(), WorkflowModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
