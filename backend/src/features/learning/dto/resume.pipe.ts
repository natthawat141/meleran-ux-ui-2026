import { PipeTransform } from '@nestjs/common';
import { ApiException } from '../../../shared/errors/api-exception';
export interface ResumeInput {position_seconds?:number|null}
export class ResumePipe implements PipeTransform<unknown,ResumeInput> {
  transform(value:unknown):ResumeInput {
    if(!value||typeof value!=='object'||Array.isArray(value))throw ApiException.validationFailed('ข้อมูลเรียนต่อไม่ถูกต้อง');
    const body=value as Record<string,unknown>;
    if(Object.keys(body).some(key=>key!=='position_seconds'))throw ApiException.validationFailed('ข้อมูลเรียนต่อไม่ถูกต้อง');
    const position=body.position_seconds;
    if(position!==undefined&&position!==null&&(typeof position!=='number'||!Number.isFinite(position)||position<0))
      throw ApiException.validationFailed('position_seconds ไม่ถูกต้อง');
    return position===undefined?{}:{position_seconds:position as number|null};
  }
}
