import { ApiException } from './api-exception';

/** Deliberate unavailable capability, with no diagnostic/provider payload. */
export class ProviderUnavailableException extends ApiException {
  constructor() {
    super('provider_unavailable',503,'ระบบเชื่อมต่อผู้ให้บริการยังไม่พร้อมใช้งาน');
  }
}
