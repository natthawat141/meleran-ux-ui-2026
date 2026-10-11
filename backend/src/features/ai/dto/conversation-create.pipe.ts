import { PipeTransform } from '@nestjs/common';
import { ApiException } from '../../../shared/errors/api-exception';
export interface ConversationCreateInput {title?:string;course_id?:string}
export class ConversationCreatePipe implements PipeTransform<unknown,ConversationCreateInput> {
  transform(value:unknown):ConversationCreateInput {
    if(!value||typeof value!=='object'||Array.isArray(value))throw ApiException.validationFailed();
    const body=value as Record<string,unknown>;
    if(Object.keys(body).some(key=>!['title','course_id'].includes(key)))throw ApiException.validationFailed();
    if(body.title!==undefined&&(typeof body.title!=='string'||!body.title.trim()||Array.from(body.title).length>80))throw ApiException.validationFailed('ชื่อแชตไม่ถูกต้อง');
    if(body.course_id!==undefined&&(typeof body.course_id!=='string'||!body.course_id))throw ApiException.validationFailed('course_id ไม่ถูกต้อง');
    return {title:body.title as string|undefined,course_id:body.course_id as string|undefined};
  }
}
