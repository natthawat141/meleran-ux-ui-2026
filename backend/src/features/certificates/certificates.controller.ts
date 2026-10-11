import { Controller, Get, Param, Query } from '@nestjs/common';
import { AuthoritativeAudience } from '../../shared/auth/session.guard';
import { CurrentPrincipal } from '../../shared/auth/current-user.decorator';
import { AuthPrincipal } from '../auth/public/index';
import { CertificateReadService } from './certificate-read.service';
import { PageQuery, PageQueryPipe } from '../../shared/pagination/keyset';

@Controller('me/certificates')
@AuthoritativeAudience('web', 'admin')
export class CertificatesController {
  constructor(private readonly certificates: CertificateReadService) {}

  @Get()
  list(@CurrentPrincipal() actor: AuthPrincipal, @Query(new PageQueryPipe()) query: PageQuery) {
    return this.certificates.list(actor.session,query);
  }

  @Get(':id')
  detail(@CurrentPrincipal() actor: AuthPrincipal, @Param('id') id: string) {
    return this.certificates.detail(actor.session, id);
  }
}
