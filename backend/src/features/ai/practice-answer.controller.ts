import { Body, Controller, Param, Put } from '@nestjs/common';
import { AuthoritativeAudience } from '../../shared/auth/session.guard';
import { CurrentPrincipal } from '../../shared/auth/current-user.decorator';
import { AuthPrincipal } from '../auth/public/index';
import { PracticeAnswerService } from './practice-answer.service';
import { PracticeAnswerInput, PracticeAnswerPipe } from './dto/practice-answer.dto';

@AuthoritativeAudience('web', 'admin')
@Controller('me/ai/conversations')
export class PracticeAnswerController {
  constructor(private readonly practice: PracticeAnswerService) {}
  @Put(':id/messages/:messageId/practice/answers')
  answer(@CurrentPrincipal() actor: AuthPrincipal, @Param('id') id: string, @Param('messageId') messageId: string,
    @Body(new PracticeAnswerPipe()) input: PracticeAnswerInput) {
    return this.practice.answer(actor.session, id, messageId, input);
  }
}
