import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'node:crypto';

/** Certificate owner; trusted completion participant, never an issuance HTTP route. */
@Injectable()
export class CompletionIssuer {
  async issue(tx:Prisma.TransactionClient,enrollmentId:string):Promise<string> {
    const existing=await tx.certificate.findUnique({where:{enrollmentId},select:{id:true}});
    if(existing)return existing.id;
    const enrollment=await tx.enrollment.findUniqueOrThrow({where:{id:enrollmentId},select:{completedAt:true,completionSnapshot:true,
      account:{select:{displayName:true}},course:{select:{title:true}}}});
    if(!enrollment.completedAt||!enrollment.completionSnapshot)throw Error('Certificate requires trusted first completion');
    const row=await tx.certificate.create({data:{enrollmentId,code:'MLN-CERT-'+randomBytes(20).toString('hex').toUpperCase(),
      recipientName:enrollment.account.displayName,courseName:enrollment.course.title,issuedAt:enrollment.completedAt},select:{id:true}});
    return row.id;
  }
}
