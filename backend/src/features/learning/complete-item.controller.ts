import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common';
import { AuthoritativeAudience } from '../../shared/auth/session.guard';
import { CurrentPrincipal } from '../../shared/auth/current-user.decorator';
import { AuthPrincipal } from '../auth/public/index';
import { EmptyRequestPipe } from '../../shared/validation/empty-request.pipe';
import { CompleteItemService } from './complete-item.service';

@Controller('learn/items')
@AuthoritativeAudience('web')
export class CompleteItemController {
  constructor(private readonly completion:CompleteItemService){}
  @Post(':id/complete') @HttpCode(200)
  complete(@CurrentPrincipal() actor:AuthPrincipal,@Param('id') id:string,@Body(new EmptyRequestPipe()) _body:void){
    return this.completion.complete(actor.session,id);
  }
}
