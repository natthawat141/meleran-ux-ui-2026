import { Controller, Get, Param } from '@nestjs/common';
import { CurrentPrincipal } from '../../shared/auth/current-user.decorator';
import { AuthoritativeAudience, Roles } from '../../shared/auth/session.guard';
import { AuthPrincipal } from '../auth/public/index';
import { LearningReadService } from './learning-read.service';

@Controller('learn/courses')
@AuthoritativeAudience('web')
@Roles('learner', 'instructor')
export class LearningController {
  constructor(private readonly learning: LearningReadService) {}
  @Get(':id')
  course(@CurrentPrincipal() actor: AuthPrincipal, @Param('id') id: string) {
    return this.learning.course(actor.session, id);
  }
  @Get(':id/items/:item_id')
  item(@CurrentPrincipal() actor: AuthPrincipal, @Param('id') id: string, @Param('item_id') itemId: string) {
    return this.learning.item(actor.session, id, itemId);
  }
}
