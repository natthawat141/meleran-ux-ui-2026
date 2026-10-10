import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { randomUUID } from 'node:crypto';
import { ApiException } from './api-exception';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const requestId: string = typeof response.locals.requestId === 'string'
      ? response.locals.requestId : randomUUID();
    response.setHeader('x-request-id', requestId);

    if (exception instanceof ApiException && exception.getStatus() < 500) {
      response.status(exception.getStatus()).json({
        error: {
          code: exception.code,
          message: exception.message,
          request_id: requestId,
          ...(exception.details ? { details: exception.details } : {}),
        },
      });
      return;
    }

    if (exception instanceof HttpException && exception.getStatus() < 500) {
      const status = exception.getStatus();
      let code = 'http_error';
      let message = 'คำขอไม่สำเร็จ';

      if (status === HttpStatus.UNAUTHORIZED) {
        code = 'authentication_required';
        message = 'กรุณาเข้าสู่ระบบ';
      } else if (status === HttpStatus.FORBIDDEN) {
        code = 'forbidden';
        message = 'ไม่มีสิทธิ์ใช้งาน';
      } else if (status === HttpStatus.NOT_FOUND) {
        code = 'not_found';
        message = 'ไม่พบข้อมูลหรือเส้นทางนี้';
      } else if (status === HttpStatus.UNPROCESSABLE_ENTITY || status === HttpStatus.BAD_REQUEST) {
        code = 'validation_failed';
        message = 'ข้อมูลไม่ถูกต้อง';
      }

      response.status(status).json({
        error: {
          code,
          message,
          request_id: requestId,
        },
      });
      return;
    }

    // Arbitrary exception objects may contain SQL, passwords or provider proofs.
    this.logger.error(`Unhandled internal exception request_id=${requestId}`);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: {
        code: 'internal_error',
        message: 'ระบบขัดข้อง กรุณาลองใหม่',
        request_id: requestId,
      },
    });
  }
}
