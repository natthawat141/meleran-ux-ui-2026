import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SelfProfileReader, SelfProfileDto, VerifiedSessionReference } from '../auth/public/index';

@Injectable()
export class SelfProfileService {
  constructor(private readonly prisma: PrismaService, private readonly identity: SelfProfileReader) {}
  read(reference: VerifiedSessionReference): Promise<SelfProfileDto> {
    return this.prisma.$transaction(tx => this.identity.read(tx, reference), {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
    });
  }
}
