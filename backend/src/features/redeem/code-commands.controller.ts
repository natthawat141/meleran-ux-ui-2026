import { Body, Controller, Post, Res } from '@nestjs/common';
import { Response } from 'express';
import { AuthoritativeAudience, Roles } from '../../shared/auth/session.guard';
import { CurrentPrincipal } from '../../shared/auth/current-user.decorator';
import { AuthPrincipal } from '../auth/public/index';
import { CodeIssuanceService } from './code-issuance.service';
import { RedeemCodeService } from './redeem-code.service';
import { IssueCodesPipe, IssueCodesInput, RedeemPipe, RedeemInput } from './dto/code-requests.pipe';

@Controller()
export class CodeCommandsController {
  constructor(private readonly codes: CodeIssuanceService, private readonly redemption: RedeemCodeService) {}

  @Post('admin/redeem-codes')
  @AuthoritativeAudience('admin')
  @Roles('admin')
  issue(@CurrentPrincipal() actor: AuthPrincipal, @Body(new IssueCodesPipe()) body: IssueCodesInput) {
    return this.codes.issue(actor.session, body);
  }

  @Post('me/redeem')
  @AuthoritativeAudience('web', 'admin')
  @Roles('learner', 'instructor')
  async redeem(@CurrentPrincipal() actor: AuthPrincipal, @Body(new RedeemPipe()) body: RedeemInput,
    @Res({ passthrough: true }) response: Response) {
    const result = await this.redemption.redeem(actor.session, body.code);
    response.status(result.already_enrolled ? 200 : 201);
    return result;
  }
}
