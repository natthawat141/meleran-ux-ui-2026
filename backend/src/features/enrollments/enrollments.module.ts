import { Module } from '@nestjs/common';
import { EnrollmentsController } from './enrollments.controller';
import { EnrollmentsService } from './enrollments.service';
import { EntitlementWriter } from './public/entitlement-writer.service';

@Module({
  controllers: [EnrollmentsController],
  providers: [EnrollmentsService, EntitlementWriter],
  exports: [EnrollmentsService, EntitlementWriter],
})
export class EnrollmentsModule {}
