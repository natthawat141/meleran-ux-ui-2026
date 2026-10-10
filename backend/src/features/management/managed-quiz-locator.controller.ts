import { Controller, Get, Param } from '@nestjs/common';
import { AuthoritativeAudience, Roles } from '../../shared/auth/session.guard';
import { CurrentPrincipal } from '../../shared/auth/current-user.decorator';
import { AuthPrincipal } from '../auth/public/index';
import { ManagedQuizLocatorService } from './managed-quiz-locator.service';

@Controller('managed-quizzes')
@AuthoritativeAudience('web', 'admin')
@Roles('instructor', 'admin')
export class ManagedQuizLocatorController {
  constructor(private readonly locators: ManagedQuizLocatorService) {}
  @Get(':id')
  locate(@CurrentPrincipal() actor: AuthPrincipal, @Param('id') id: string) {
    return this.locators.read(actor.session, id);
  }
}
