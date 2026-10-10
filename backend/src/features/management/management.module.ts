import { Module } from '@nestjs/common';
import { ManagementController } from './management.controller';
import { ManagementService } from './management.service';
import { AuthModule } from '../auth/auth.module';
import { AssignInstructorService } from './assign-instructor.service';

@Module({
  imports: [AuthModule],
  controllers: [ManagementController],
  providers: [ManagementService, AssignInstructorService],
  exports: [ManagementService],
})
export class ManagementModule {}
