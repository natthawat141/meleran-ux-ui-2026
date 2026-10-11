import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PrincipalService,VerifiedSessionReference } from '../auth/public/index';
import { ApiException } from '../../shared/errors/api-exception';
import { ManagedAttemptReader,ManagedAttemptDto } from './public/index';
export type { ManagedAttemptDto } from './public/index';

@Injectable()
export class ManagedAttemptReadService{
  constructor(private readonly prisma:PrismaService,private readonly principals:PrincipalService,private readonly reader:ManagedAttemptReader){}
  read(reference:VerifiedSessionReference,id:string):Promise<ManagedAttemptDto>{
    return this.prisma.$transaction(async tx=>{
      const actor=await this.principals.requireAuthoring(tx,reference);
      if(reference.audience!=='web'||actor.roles.includes('admin')||!actor.roles.includes('instructor'))throw ApiException.forbidden();
      const courses=await tx.$queryRaw<Array<{id:string}>>(Prisma.sql`
        SELECT c.id FROM courses c JOIN quiz_attempts a ON a."courseId"=c.id
        WHERE a.id=${id} AND c."instructorId"=${actor.accountId} FOR SHARE OF c`);
      if(!courses.length)throw ApiException.notFound('ไม่พบการทำแบบฝึกหัด');
      return this.reader.read(tx,{id,courseId:courses[0].id});
    },{isolationLevel:Prisma.TransactionIsolationLevel.ReadCommitted});
  }
}
