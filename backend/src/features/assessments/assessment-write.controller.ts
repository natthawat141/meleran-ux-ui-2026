import { Body,Controller,Get,HttpCode,Param,Post,Put,Query,Res } from '@nestjs/common';
import type { Response } from 'express';
import { AuthoritativeAudience } from '../../shared/auth/session.guard';
import { CurrentPrincipal } from '../../shared/auth/current-user.decorator';
import { AuthPrincipal } from '../auth/public/index';
import { EmptyRequestPipe } from '../../shared/validation/empty-request.pipe';
import { PageQuery,PageQueryPipe } from '../../shared/pagination/keyset';
import { AssessmentWriteService } from './assessment-write.service';
import { AssessmentHistoryService } from './assessment-history.service';
import { ManualGrade,ManualGradePipe,SaveAnswers,SaveAnswersPipe } from './dto/assessment-write.pipe';

@Controller() @AuthoritativeAudience('web') export class AssessmentWriteController{
  constructor(private readonly writes:AssessmentWriteService,private readonly history:AssessmentHistoryService){}
  @Post('learn/items/:id/attempts')
  async start(@CurrentPrincipal() actor:AuthPrincipal,@Param('id') id:string,@Body(new EmptyRequestPipe()) _body:void,@Res({passthrough:true}) response:Response){
    const result=await this.writes.start(actor.session,id);response.status(result.created?201:200);return result.view;
  }
  @Put('learn/attempts/:id/answers')
  save(@CurrentPrincipal() actor:AuthPrincipal,@Param('id') id:string,@Body(new SaveAnswersPipe()) body:SaveAnswers){return this.writes.save(actor.session,id,body);}
  @Post('learn/attempts/:id/submit') @HttpCode(200)
  submit(@CurrentPrincipal() actor:AuthPrincipal,@Param('id') id:string,@Body(new EmptyRequestPipe()) _body:void){return this.writes.submit(actor.session,id);}
  @Get('learn/items/:id/results')
  results(@CurrentPrincipal() actor:AuthPrincipal,@Param('id') id:string){return this.history.results(actor.session,id);}
  @Get('instructor/grading-queue')
  queue(@CurrentPrincipal() actor:AuthPrincipal,@Query(new PageQueryPipe()) query:PageQuery){return this.history.queue(actor.session,query);}
  @Put('instructor/attempts/:id/questions/:question_id/grade')
  grade(@CurrentPrincipal() actor:AuthPrincipal,@Param('id') id:string,@Param('question_id') questionId:string,@Body(new ManualGradePipe()) body:ManualGrade){return this.writes.grade(actor.session,id,questionId,body);}
}
