import { HttpException, HttpStatus } from '@nestjs/common';

export interface ValidationField { field: string; code: string }
export interface ResourceErrorDetails {
  fields?: ValidationField[];
  current_revision?: number;
}

export class ApiException extends HttpException {
  public readonly code: string;

  constructor(
    code: string,
    status: HttpStatus,
    message: string,
    public readonly details?: ResourceErrorDetails,
  ) {
    super({ error: { code, message } }, status);
    this.code = code;
    // Nest cannot infer Error.message from our nested canonical envelope.
    this.message = message;
  }

  static notFound(message = 'ไม่พบข้อมูลที่ต้องการ') {
    return new ApiException('not_found', HttpStatus.NOT_FOUND, message);
  }

  static forbidden(message = 'ไม่มีสิทธิ์ดำเนินการ') {
    return new ApiException('forbidden', HttpStatus.FORBIDDEN, message);
  }

  static unauthorized(message = 'กรุณาเข้าสู่ระบบ') {
    return new ApiException('credentials_invalid', HttpStatus.UNAUTHORIZED, message);
  }

  static validationFailed(message = 'ข้อมูลไม่ถูกต้อง', details?: ResourceErrorDetails) {
    return new ApiException('validation_failed', HttpStatus.UNPROCESSABLE_ENTITY, message, details);
  }

  static conflict(code: string, message: string) {
    return new ApiException(code, HttpStatus.CONFLICT, message);
  }
}
