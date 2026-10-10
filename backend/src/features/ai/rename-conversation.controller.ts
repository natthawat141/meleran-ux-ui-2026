import { Body, Controller, Param, Patch } from '@nestjs/common';
import { AuthoritativeAudience } from '../../shared/auth/session.guard';
import { CurrentPrincipal } from '../../shared/auth/current-user.decorator';
import { AuthPrincipal } from '../auth/public/index';
import { RenameConversationInput, RenameConversationPipe } from './dto/rename-conversation.dto';
import { RenameConversationService } from './rename-conversation.service';

@AuthoritativeAudience('web', 'admin')
@Controller('me/ai/conversations')
export class RenameConversationController {
  constructor(private readonly conversations: RenameConversationService) {}
  @Patch(':id')
  rename(@CurrentPrincipal() actor: AuthPrincipal, @Param('id') id: string,
    @Body(new RenameConversationPipe()) input: RenameConversationInput) { return this.conversations.rename(actor.session, id, input); }
}
