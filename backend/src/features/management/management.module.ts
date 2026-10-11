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

@Module({
  imports: [AuthModule],
  controllers: [ManagementController, ManagedQuizLocatorController, SummaryController],
  providers: [AssignInstructorService, ManagedQuizLocatorService, AdminUserDetailService, SummaryService,
    AdminAccountCreateService, AccountDirectoryService],
})
export class ManagementModule {}
