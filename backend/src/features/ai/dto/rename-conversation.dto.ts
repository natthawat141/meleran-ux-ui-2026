import { Injectable, PipeTransform } from '@nestjs/common';
import { ApiException, ValidationField } from '../../../shared/errors/api-exception';

export interface RenameConversationInput { title: string }
export interface AiConversationDto { id: string; title: string; course_id: string | null; created_at: string; updated_at: string }

@Injectable()
export class RenameConversationPipe implements PipeTransform<unknown, RenameConversationInput> {
  transform(value: unknown): RenameConversationInput {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw ApiException.validationFailed();
    const body = value as Record<string, unknown>, fields: ValidationField[] = [];
    for (const key of Object.keys(body)) if (key !== 'title') fields.push({ field: key, code: 'unsupported' });
    if (!Object.prototype.hasOwnProperty.call(body, 'title')) fields.push({ field: 'title', code: 'required' });
    else if (typeof body.title !== 'string' || !body.title.trim() || Array.from(body.title).length > 80) fields.push({ field: 'title', code: 'invalid' });
    if (fields.length) throw ApiException.validationFailed('ชื่อแชตไม่ถูกต้อง', { fields });
    // Canonical maxLength counts Unicode code points. Retain valid input text;
    // prototype trimming/UTF-16 limits are not a replacement business contract.
    return { title: body.title as string };
  }
}
