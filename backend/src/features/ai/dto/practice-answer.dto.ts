import { Injectable, PipeTransform } from '@nestjs/common';
import { ApiException, ValidationField } from '../../../shared/errors/api-exception';

export interface PracticeAnswerInput { question_id: string; option_id: string }
export interface PracticeAnswerDto {
  question_id: string;
  correct: boolean;
  explanation: string;
  summary: { answered: number; total: number; correct_count: number } | null;
}

/** Exact required canonical object; client scores/keys/timestamps are rejected. */
@Injectable()
export class PracticeAnswerPipe implements PipeTransform<unknown, PracticeAnswerInput> {
  transform(value: unknown): PracticeAnswerInput {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw ApiException.validationFailed();
    const body = value as Record<string, unknown>, fields: ValidationField[] = [];
    for (const key of Object.keys(body)) if (!['question_id', 'option_id'].includes(key)) fields.push({ field: key, code: 'unsupported' });
    for (const key of ['question_id', 'option_id']) {
      if (!Object.prototype.hasOwnProperty.call(body, key)) fields.push({ field: key, code: 'required' });
      else if (typeof body[key] !== 'string' || body[key].length === 0) fields.push({ field: key, code: 'invalid' });
    }
    if (fields.length) throw ApiException.validationFailed('คำตอบไม่ถูกต้อง', { fields });
    return { question_id: body.question_id as string, option_id: body.option_id as string };
  }
}
