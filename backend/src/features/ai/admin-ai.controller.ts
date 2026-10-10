import { Body, Controller, Get, Param, Patch, Put } from '@nestjs/common';
import { AuthoritativeAudience, Roles } from '../../shared/auth/session.guard';
import { CurrentPrincipal } from '../../shared/auth/current-user.decorator';
import { AuthPrincipal } from '../auth/public/index';
import { AdminAiService } from './admin-ai.service';
import { AiSupportRequestDto, TranscriptRequestDto } from './dto/admin-ai.dto';

@AuthoritativeAudience('admin')
@Roles('admin')
@Controller('admin/courses')
export class AdminAiController {
  constructor(private readonly ai: AdminAiService) {}
  @Patch(':id/ai-support')
  setSupport(@CurrentPrincipal() actor: AuthPrincipal, @Param('id') id: string, @Body() body: AiSupportRequestDto) {
    return this.ai.setSupport(actor.session, id, body.ai_enabled);
  }
  @Get(':id/videos/:itemId/ai-transcript')
  getTranscript(@CurrentPrincipal() actor: AuthPrincipal, @Param('id') id: string, @Param('itemId') itemId: string) {
    return this.ai.getTranscript(actor.session, id, itemId);
  }
  @Put(':id/videos/:itemId/ai-transcript')
  putTranscript(@CurrentPrincipal() actor: AuthPrincipal, @Param('id') id: string, @Param('itemId') itemId: string,
    @Body() body: TranscriptRequestDto) { return this.ai.putTranscript(actor.session, id, itemId, body.text); }
}
