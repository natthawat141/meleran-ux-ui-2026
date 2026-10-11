import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PrincipalService,VerifiedSessionReference } from '../auth/public/index';
import { ApiException } from '../../shared/errors/api-exception';
import { projectStoredPayment } from './stored-payment-view';

@Injectable()
export class AdminPaymentReadService {
  constructor(private readonly prisma:PrismaService,private readonly principals:PrincipalService){}
  read(reference:VerifiedSessionReference,id:string){
    return this.prisma.$transaction(async tx=>{
      await this.principals.requireAdmin(tx,reference);
      const found=await tx.$queryRaw<Array<{id:string}>>(Prisma.sql`SELECT id FROM payments WHERE id=${id} FOR SHARE`);
      if(!found.length)throw ApiException.notFound('ไม่พบรายการชำระเงิน');
      const row=await tx.payment.findUniqueOrThrow({where:{id},select:{id:true,accountId:true,courseId:true,status:true,
        fulfillmentStatus:true,enrollmentId:true,amountMinor:true,currency:true,requestId:true,checkoutSessionId:true,createdAt:true,
        events:{orderBy:[{receivedAt:'asc'},{eventId:'asc'}],select:{eventId:true,type:true,receivedAt:true,processedAt:true,status:true}}}});
      if(!Number.isSafeInteger(row.amountMinor)||row.amountMinor<0||row.currency!=='THB')throw Error('Invalid stored payment amount');
      const view=await projectStoredPayment(tx,row);
      // Draft WireAdminPayment requires string; empty denotes no session allocated yet.
      // Never synthesize a Stripe identifier or contact the provider during a read.
      return {...view,user_id:row.accountId,request_id:row.requestId,checkout_session_id:row.checkoutSessionId??'',
        amount:{amount_minor:row.amountMinor,currency:'THB' as const},created_at:row.createdAt.toISOString(),
        events:row.events.map(event=>({event_id:event.eventId,type:event.type,received_at:event.receivedAt.toISOString(),
          processed_at:event.processedAt?.toISOString()??null,outcome:event.status}))};
    },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});
  }
}
