import { Injectable, PipeTransform } from '@nestjs/common';
import { ApiException } from '../../../shared/errors/api-exception';

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
export interface IssueCodesInput { course_id: string; count?: number }
export interface RedeemInput { code: string }

@Injectable()
export class IssueCodesPipe implements PipeTransform<unknown, IssueCodesInput> {
  transform(value: unknown): IssueCodesInput {
    if (!record(value) || Object.keys(value).some(key => !['course_id', 'count'].includes(key)) ||
      typeof value.course_id !== 'string' || !value.course_id.length ||
      (value.count !== undefined && (!Number.isInteger(value.count) || Number(value.count) < 1 || Number(value.count) > 50))) {
      throw ApiException.validationFailed();
    }
    return value as unknown as IssueCodesInput;
  }
}

@Injectable()
export class RedeemPipe implements PipeTransform<unknown, RedeemInput> {
  transform(value: unknown): RedeemInput {
    if (!record(value) || Object.keys(value).some(key => key !== 'code') || typeof value.code !== 'string' || !value.code.length) {
      throw ApiException.validationFailed();
    }
    return value as unknown as RedeemInput;
  }
}
