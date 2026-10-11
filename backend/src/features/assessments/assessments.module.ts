import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AttemptReadController } from './attempt-read.controller';
import { AttemptReadService } from './attempt-read.service';
import { ManagedAttemptReadService } from './managed-attempt-read.service';
import { ManagedAttemptReadController } from './managed-attempt-read.controller';
import { BestResultReader } from './public/index';

@Module({ imports: [AuthModule], controllers: [AttemptReadController,ManagedAttemptReadController], providers: [AttemptReadService,ManagedAttemptReadService,BestResultReader], exports:[BestResultReader] })
export class AssessmentsModule {}
