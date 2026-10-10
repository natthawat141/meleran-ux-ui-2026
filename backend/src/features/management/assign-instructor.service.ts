import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { InstructorGrantWriter, InstructorGrantDto, VerifiedSessionReference } from '../auth/public/index';

@Injectable()
export class AssignInstructorService {
  constructor(private readonly prisma: PrismaService, private readonly grants: InstructorGrantWriter) {}
  assign(reference: VerifiedSessionReference, id: string): Promise<InstructorGrantDto> {
    return this.prisma.$transaction(tx => this.grants.grant(tx, reference, id), {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
    });
  }
}
