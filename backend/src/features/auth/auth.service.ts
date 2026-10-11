import { Injectable } from '@nestjs/common';
import { ApiException } from '../../shared/errors/api-exception';
import { ProviderUnavailableException } from '../../shared/errors/provider-unavailable.exception';
import { LocalAuthenticationService } from './local-authentication.service';
import { AppAudience } from './public/principal.service';

/** Firebase Email credentials never use a local password or an email-based merge. */
@Injectable()
export class AuthService {
  constructor(private readonly local: LocalAuthenticationService) {}

  async login(identifier: string, password: string, audience: string, appHeader?: string) {
    if (!['web', 'admin'].includes(audience) || appHeader !== audience)
      throw ApiException.validationFailed('พื้นที่เข้าสู่ระบบไม่ตรงกับแอป');
    if (identifier.includes('@'))
      throw new ProviderUnavailableException();
    return this.local.loginUsername(identifier, password, audience as AppAudience);
  }
}
