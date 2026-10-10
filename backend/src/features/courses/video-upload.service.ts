import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PrincipalService, VerifiedSessionReference } from '../auth/public/index';
import { ApiException } from '../../shared/errors/api-exception';
import { VideoUploadUnavailableException } from '../../shared/errors/video-upload-unavailable.exception';

@Injectable()
export class VideoUploadService {
  constructor(private readonly prisma: PrismaService, private readonly principals: PrincipalService) {}

  async unavailable(reference: VerifiedSessionReference, courseId: string): Promise<never> {
    return this.prisma.$transaction(async tx => {
      const actor = await this.principals.requireAuthoring(tx, reference);
      const courses = await tx.$queryRaw<Array<{ id: string; instructorId: string }>>(Prisma.sql`
        SELECT id,"instructorId" FROM courses WHERE id=${courseId} FOR SHARE`);
      const course = courses[0];
      if (!course) throw ApiException.notFound('ไม่พบคอร์ส');
      if (!actor.roles.includes('admin') && course.instructorId !== actor.accountId) throw ApiException.forbidden();
      // Authorize even when unavailable. No bytes, upload rows, URL mutation,
      // entitlement, or provider calls; the transaction contains reads only.
      throw new VideoUploadUnavailableException();
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  }
}
