import { Controller, Get, Param } from '@nestjs/common';
import { AuthoritativeAudience } from '../../shared/auth/session.guard';
import { CurrentPrincipal } from '../../shared/auth/current-user.decorator';
import { AuthPrincipal } from '../auth/public/index';
import { CertificateReadService } from './certificate-read.service';

@Controller('me/certificates')
@AuthoritativeAudience('web', 'admin')
export class CertificatesController {
  constructor(private readonly certificates: CertificateReadService) {}

  @Get(':id')
  detail(@CurrentPrincipal() actor: AuthPrincipal, @Param('id') id: string) {
    return this.certificates.detail(actor.session, id);
  }
}
