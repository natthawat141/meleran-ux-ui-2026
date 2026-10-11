import { Module } from '@nestjs/common';
import { BestResultReader,ManagedAttemptReader } from './public/index';

/** Read participants have no dependency on academic writers/completion. */
@Module({providers:[BestResultReader,ManagedAttemptReader],exports:[BestResultReader,ManagedAttemptReader]})
export class AssessmentReadModule{}
