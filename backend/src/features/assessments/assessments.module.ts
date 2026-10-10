import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AttemptReadController } from './attempt-read.controller';
import { AttemptReadService } from './attempt-read.service';

@Module({ imports: [AuthModule], controllers: [AttemptReadController], providers: [AttemptReadService] })
export class AssessmentsModule {}
