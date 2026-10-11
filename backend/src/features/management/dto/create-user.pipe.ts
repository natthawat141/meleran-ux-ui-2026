import { PipeTransform } from '@nestjs/common';
import { ApiException } from '../../../shared/errors/api-exception';
export interface CreateUserInput {username:string;password:string;display_name:string;email?:string|null}
export class CreateUserPipe implements PipeTransform<unknown,CreateUserInput> {
  transform(value:unknown):CreateUserInput {
    if(!value||typeof value!=='object'||Array.isArray(value))throw ApiException.validationFailed();
    const b=value as Record<string,unknown>;
    if(Object.keys(b).some(k=>!['username','password','display_name','email'].includes(k))||
      typeof b.username!=='string'||!/^[A-Za-z0-9_.]{3,30}$/.test(b.username)||
      typeof b.password!=='string'||Array.from(b.password).length<8||Array.from(b.password).length>128||
      typeof b.display_name!=='string'||!b.display_name.trim())throw ApiException.validationFailed('ข้อมูลบัญชีไม่ถูกต้อง');
    if(b.email!==undefined&&b.email!==null&&(typeof b.email!=='string'||b.email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email)))
      throw ApiException.validationFailed('อีเมลไม่ถูกต้อง');
    return {username:b.username,password:b.password,display_name:b.display_name,email:b.email as string|null|undefined};
  }
}
