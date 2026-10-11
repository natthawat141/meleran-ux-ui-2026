import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminAccountWriter, AdminAccountResult, VerifiedSessionReference } from '../auth/public/index';
import { CreateUserInput } from './dto/create-user.pipe';
import { ApiException } from '../../shared/errors/api-exception';

@Injectable()
export class AdminAccountCreateService {
  constructor(private readonly prisma:PrismaService,private readonly writer:AdminAccountWriter){}
  async create(reference:VerifiedSessionReference,input:CreateUserInput):Promise<AdminAccountResult> {
    // KDF work outside resource transactions; Auth writer rechecks fresh Admin
    // authority after hashing before any account/role/credential is persisted.
    const passwordHash=await this.writer.hash(input.password);
    try {
      return await this.prisma.$transaction(tx=>this.writer.create(tx,reference,{username:input.username,
        displayName:input.display_name,email:input.email??null,passwordHash}),{isolationLevel:Prisma.TransactionIsolationLevel.ReadCommitted});
    } catch(error) {
      if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2002') {
        const target=JSON.stringify(error.meta?.target??'');
        if(/email/i.test(target))throw ApiException.conflict('email_taken','อีเมลนี้ถูกใช้แล้ว');
        throw ApiException.conflict('username_taken','ชื่อผู้ใช้นี้ถูกใช้แล้ว');
      }
      throw error;
    }
  }
}
