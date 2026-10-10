import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common';
import { AuthoritativeAudience, Roles } from '../../shared/auth/session.guard';
import { CurrentPrincipal } from '../../shared/auth/current-user.decorator';
import { EmptyRequestPipe } from '../../shared/validation/empty-request.pipe';
import { AuthPrincipal } from '../auth/public/index';
import { RevokeCodeService } from './revoke-code.service';

@AuthoritativeAudience('admin')
@Roles('admin')
@Controller('admin/redeem-codes')
export class RevokeCodeController {
  constructor(private readonly codes: RevokeCodeService) {}

  @Post(':id/revoke')
  @HttpCode(200)
  revoke(@CurrentPrincipal() actor: AuthPrincipal, @Param('id') id: string,
    @Body(new EmptyRequestPipe()) _body: unknown) { return this.codes.revoke(actor.session, id); }
}
