import { Injectable, PipeTransform } from '@nestjs/common';
import { ApiException } from '../../../shared/errors/api-exception';

/** Canonical optional EmptyRequest: only an omitted body or empty JSON object. */
@Injectable()
export class EmptyRequestPipe implements PipeTransform<unknown, void> {
  transform(value: unknown): void {
    if (value === undefined) return;
    if (value === null || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length) {
      throw ApiException.validationFailed('คำขอนี้ไม่รับข้อมูลเพิ่มเติม');
    }
  }
}
