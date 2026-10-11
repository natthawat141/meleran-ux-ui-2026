import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { AuthoritativeAudience } from '../../shared/auth/session.guard';
import { CurrentPrincipal } from '../../shared/auth/current-user.decorator';
import { AuthPrincipal } from '../auth/public/index';
import { PageQuery, PageQueryPipe } from '../../shared/pagination/keyset';
import { EmptyRequestPipe } from '../../shared/validation/empty-request.pipe';
import { ConversationCreateInput, ConversationCreatePipe } from './dto/conversation-create.pipe';
import { ConversationHistoryService } from './conversation-history.service';

@Controller('me/ai/conversations')
@AuthoritativeAudience('web','admin')
export class ConversationHistoryController {
  constructor(private readonly history:ConversationHistoryService){}
  @Post()
  @HttpCode(200)
  create(@CurrentPrincipal() actor:AuthPrincipal,@Body(new ConversationCreatePipe()) input:ConversationCreateInput) {
    return this.history.create(actor.session,input);
  }
  @Get()
  list(@CurrentPrincipal() actor:AuthPrincipal,@Query(new PageQueryPipe(['q'])) query:PageQuery) {
    return this.history.list(actor.session,query);
  }
  @Get(':id/messages')
  messages(@CurrentPrincipal() actor:AuthPrincipal,@Param('id') id:string,@Query(new PageQueryPipe()) query:PageQuery) {
    return this.history.messages(actor.session,id,query);
  }
  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentPrincipal() actor:AuthPrincipal,@Param('id') id:string,@Body(new EmptyRequestPipe()) _body:unknown,
    @Query(new EmptyRequestPipe()) _query:unknown) {
    return this.history.remove(actor.session,id);
  }
}
