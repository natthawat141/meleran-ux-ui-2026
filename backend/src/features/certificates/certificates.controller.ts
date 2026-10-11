import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import { AuthoritativeAudience } from '../../shared/auth/session.guard';
import { CurrentPrincipal } from '../../shared/auth/current-user.decorator';
import { AuthPrincipal } from '../auth/public/index';
import { CertificateReadService } from './certificate-read.service';
import { PageQuery, PageQueryPipe } from '../../shared/pagination/keyset';
import { CertificateDownloadService } from './certificate-download.service';

@Controller('me/certificates')
@AuthoritativeAudience('web', 'admin')
export class CertificatesController {
  constructor(private readonly certificates: CertificateReadService,private readonly downloads:CertificateDownloadService) {}

  @Get()
  list(@CurrentPrincipal() actor: AuthPrincipal, @Query(new PageQueryPipe()) query: PageQuery) {
    return this.certificates.list(actor.session,query);
  }

  @Get(':id')
  detail(@CurrentPrincipal() actor: AuthPrincipal, @Param('id') id: string) {
    return this.certificates.detail(actor.session, id);
  }
  @Get(':id/download') @Header('Cache-Control','private, no-store')
  download(@CurrentPrincipal() actor:AuthPrincipal,@Param('id') id:string){return this.downloads.download(actor.session,id);}
}
