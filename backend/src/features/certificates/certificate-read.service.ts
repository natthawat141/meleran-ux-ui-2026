import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PrincipalService, VerifiedSessionReference } from '../auth/public/index';
import { ApiException } from '../../shared/errors/api-exception';
import { CertificateDetailDto } from './dto/certificate-detail.dto';
import { Page, PageQuery, decodeCursor, page } from '../../shared/pagination/keyset';

@Injectable()
export class CertificateReadService {
  constructor(private readonly prisma: PrismaService, private readonly principals: PrincipalService) {}

  list(reference: VerifiedSessionReference, query: PageQuery): Promise<Page<CertificateDetailDto>> {
    return this.prisma.$transaction(async tx => {
      const actor = await this.principals.requireSelfRead(tx, reference);
      const cursor = decodeCursor('own-certificates', query, actor.accountId);
      const where: Prisma.CertificateWhereInput = { enrollment: { accountId: actor.accountId } };
      if (cursor) where.OR = [{ issuedAt: { lt: cursor.at } }, { issuedAt: cursor.at, id: { gt: cursor.id } }];
      const rows = await tx.certificate.findMany({ where, orderBy: [{ issuedAt:'desc' }, { id:'asc' }], take:query.limit+1,
        select:{id:true,code:true,courseName:true,recipientName:true,issuedAt:true,enrollmentId:true,
          enrollment:{select:{courseId:true,completedAt:true}}} });
      return page('own-certificates',query,rows,row=>({id:row.id,at:row.issuedAt}),row=>{
        if (!row.enrollment.completedAt) throw Error('Missing certificate completion proof');
        return {id:row.id,code:row.code,course_id:row.enrollment.courseId,course_title:row.courseName,
          learner_name:row.recipientName,issued_at:row.issuedAt.toISOString(),enrollment_id:row.enrollmentId};
      },actor.accountId);
    },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});
  }

  async detail(reference: VerifiedSessionReference, certificateId: string): Promise<CertificateDetailDto> {
    return this.prisma.$transaction(async tx => {
      const actor = await this.principals.requireSelfRead(tx, reference);
      // Resolve ownership before selecting certificate names or academic data.
      // No Course visibility/recompletion check: an issued historical record
      // remains valid after authoring changes or later management-role grants.
      const owned = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT e.id FROM enrollments e JOIN certificates c ON c."enrollmentId"=e.id
        WHERE c.id=${certificateId} AND e."accountId"=${actor.accountId} FOR SHARE OF e`);
      if (!owned.length) throw ApiException.notFound('ไม่พบใบรับรอง');
      // Use the same Enrollment-before-Certificate resource order as a future
      // completion issuer. Recheck linkage if a concurrent deletion wins first.
      const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT id FROM certificates WHERE id=${certificateId} AND "enrollmentId"=${owned[0].id} FOR SHARE`);
      if (!rows.length) throw ApiException.notFound('ไม่พบใบรับรอง');
      const certificate = await tx.certificate.findUniqueOrThrow({ where: { id: rows[0].id }, select: {
        id: true, code: true, courseName: true, recipientName: true, issuedAt: true, enrollmentId: true,
        enrollment: { select: { courseId: true, completedAt: true } },
      } });
      // DB-02 protects immutable issuance and completed Enrollment linkage.
      // Fail closed for malformed legacy state, never repair/issue from a GET.
      if (!certificate.enrollment.completedAt) throw new Error('Missing certificate completion proof');
      return { id: certificate.id, code: certificate.code, course_id: certificate.enrollment.courseId,
        course_title: certificate.courseName, learner_name: certificate.recipientName,
        issued_at: certificate.issuedAt.toISOString(), enrollment_id: certificate.enrollmentId };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  }
}
