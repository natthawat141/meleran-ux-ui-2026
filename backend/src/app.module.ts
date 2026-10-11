import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './features/auth/auth.module';
import { AccountsModule } from './features/accounts/accounts.module';
import { CoursesModule } from './features/courses/courses.module';
import { EnrollmentsModule } from './features/enrollments/enrollments.module';
import { ManagementModule } from './features/management/management.module';
import { PaymentsModule } from './features/payments/payments.module';
import { AiModule } from './features/ai/ai.module';
import { LearningModule } from './features/learning/learning.module';
import { RedeemModule } from './features/redeem/redeem.module';
import { CertificatesModule } from './features/certificates/certificates.module';
import { AssessmentsModule } from './features/assessments/assessments.module';
import { SessionGuard } from './shared/auth/session.guard';
import { BlogModule } from './features/blog/blog.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    AccountsModule,
    CoursesModule,
    EnrollmentsModule,
    ManagementModule,
    PaymentsModule,
    AiModule,
    LearningModule,
    RedeemModule,
    CertificatesModule,
    AssessmentsModule,
    BlogModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: SessionGuard,
    },
  ],
})
export class AppModule {}
