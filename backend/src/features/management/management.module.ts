import { Module } from '@nestjs/common';
import { ManagementController } from './management.controller';
import { AuthModule } from '../auth/auth.module';
import { AssignInstructorService } from './assign-instructor.service';
import { ManagedQuizLocatorController } from './managed-quiz-locator.controller';
import { ManagedQuizLocatorService } from './managed-quiz-locator.service';
import { AdminUserDetailService } from './admin-user-detail.service';
import { SummaryController } from './summary.controller';
import { SummaryService } from './summary.service';
import { AdminAccountCreateService } from './admin-account-create.service';
import { AccountDirectoryService } from './account-directory.service';
import { RosterReadService } from './roster-read.service';
import { RosterReadController } from './roster-read.controller';
import { AssessmentsModule } from '../assessments/assessments.module';
import { AttemptListService } from './attempt-list.service';
import { AttemptListController } from './attempt-list.controller';

@Module({
  imports: [AuthModule,AssessmentsModule],
  controllers: [ManagementController, ManagedQuizLocatorController, SummaryController,RosterReadController,AttemptListController],
  providers: [AssignInstructorService, ManagedQuizLocatorService, AdminUserDetailService, SummaryService,
    AdminAccountCreateService, AccountDirectoryService,RosterReadService,AttemptListService],
})
export class ManagementModule {}
