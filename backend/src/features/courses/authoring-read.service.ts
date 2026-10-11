import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PrincipalService,VerifiedSessionReference } from '../auth/public/index';
import { ApiException } from '../../shared/errors/api-exception';
import { AuthoringDto,PreviewDto,authoringSelect,authoringView,previewView } from './dto/authoring-course.dto';

@Injectable()
export class AuthoringReadService{
  constructor(private readonly prisma:PrismaService,private readonly principals:PrincipalService){}
  read(reference:VerifiedSessionReference,id:string,preview:true):Promise<PreviewDto>;
  read(reference:VerifiedSessionReference,id:string,preview:false):Promise<AuthoringDto>;
  read(reference:VerifiedSessionReference,id:string,preview:boolean):Promise<AuthoringDto|PreviewDto>{
    return this.prisma.$transaction(async tx=>{
      const actor=await this.principals.requireAuthoring(tx,reference);
      const rows=await tx.$queryRaw<Array<{id:string}>>(Prisma.sql`
        SELECT id FROM courses WHERE id=${id} AND (${actor.roles.includes('admin')} OR "instructorId"=${actor.accountId}) FOR SHARE`);
      if(!rows.length)throw ApiException.notFound('ไม่พบคอร์สที่จัดการได้');
      const row=await tx.course.findUniqueOrThrow({where:{id},select:authoringSelect});
      // Preview query never selects correct keys, transcripts, account profiles or learner answers.
      if(preview)return previewView(row);
      const keys=await tx.question.findMany({where:{quiz:{courseId:id}},select:{id:true,correctKey:true}});
      return authoringView(row,new Map(keys.map(q=>[q.id,q.correctKey])));
    },{isolationLevel:Prisma.TransactionIsolationLevel.ReadCommitted});
  }
}
