import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SelfProfileWriter, SelfProfilePatch, SelfProfileDto, VerifiedSessionReference } from '../auth/public/index';
import { ApiException } from '../../shared/errors/api-exception';
@Injectable()
export class SelfProfileUpdateService {
  constructor(private readonly prisma:PrismaService,private readonly writer:SelfProfileWriter){}
  async update(reference:VerifiedSessionReference,patch:SelfProfilePatch):Promise<SelfProfileDto>{
    try{return await this.prisma.$transaction(tx=>this.writer.write(tx,reference,patch),{isolationLevel:Prisma.TransactionIsolationLevel.ReadCommitted});}
    catch(error){
      if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2002'&&
          /username/i.test(JSON.stringify(error.meta)))throw new ApiException('username_taken',409,'ชื่อผู้ใช้นี้ถูกใช้แล้ว',{fields:[{field:'username',code:'taken'}]});
      throw error;
    }
  }
}
