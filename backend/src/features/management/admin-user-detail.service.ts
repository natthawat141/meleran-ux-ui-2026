import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminUserDetailReader, AdminUserDetailDto, VerifiedSessionReference } from '../auth/public/index';

@Injectable()
export class AdminUserDetailService {
  constructor(private readonly prisma: PrismaService, private readonly users: AdminUserDetailReader) {}
  read(reference: VerifiedSessionReference, id: string): Promise<AdminUserDetailDto> {
    return this.prisma.$transaction(tx => this.users.read(tx, reference, id), {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
    });
  }
}
