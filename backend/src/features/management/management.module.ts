import { Module } from '@nestjs/common';
import { ManagementController } from './management.controller';
import { ManagementService } from './management.service';
import { AuthModule } from '../auth/auth.module';
import { AssignInstructorService } from './assign-instructor.service';
import { ManagedQuizLocatorController } from './managed-quiz-locator.controller';
import { ManagedQuizLocatorService } from './managed-quiz-locator.service';

@Module({
  imports: [AuthModule],
  controllers: [ManagementController, ManagedQuizLocatorController],
  providers: [ManagementService, AssignInstructorService, ManagedQuizLocatorService],
  exports: [ManagementService],
})
export class ManagementModule {}
