import { ValidationError } from 'class-validator';
import { ApiException, ValidationField } from './api-exception';

function flatten(errors: ValidationError[], parent = ''): ValidationField[] {
  return errors.flatMap(error => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const own = error.constraints ? [{ field, code: 'invalid' }] : [];
    return [...own, ...flatten(error.children || [], field)];
  });
}

export function validationException(errors: ValidationError[]): ApiException {
  return ApiException.validationFailed('ข้อมูลที่ส่งไม่ถูกต้อง', { fields: flatten(errors) });
}
