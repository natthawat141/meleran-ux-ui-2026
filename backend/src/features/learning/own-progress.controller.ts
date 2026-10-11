import { Controller,Get,Query } from '@nestjs/common';
import { AuthoritativeAudience } from '../../shared/auth/session.guard';
import { CurrentPrincipal } from '../../shared/auth/current-user.decorator';
import { AuthPrincipal } from '../auth/public/index';
import { PageQuery,PageQueryPipe } from '../../shared/pagination/keyset';
import { OwnProgressService } from './own-progress.service';

@Controller('me/progress') @AuthoritativeAudience('web','admin')
export class OwnProgressController {
  constructor(private readonly progress:OwnProgressService){}
  @Get() list(@CurrentPrincipal() actor:AuthPrincipal,@Query(new PageQueryPipe()) query:PageQuery){return this.progress.list(actor.session,query);}
}
