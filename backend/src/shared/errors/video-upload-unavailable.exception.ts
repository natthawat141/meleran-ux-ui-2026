import { ApiException } from './api-exception';

/** Fixed canonical V1 capability error; never accepts caller diagnostics. */
export class VideoUploadUnavailableException extends ApiException {
  constructor() { super('video_upload_not_available', 503, 'ขออภัย ระบบนี้ยังไม่พร้อมใช้งาน'); }
}
