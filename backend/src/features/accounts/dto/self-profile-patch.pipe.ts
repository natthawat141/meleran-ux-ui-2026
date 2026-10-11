import { Injectable, PipeTransform } from '@nestjs/common';
import { ApiException, ValidationField } from '../../../shared/errors/api-exception';
import { SelfProfilePatch } from '../../auth/public/index';

const strings: Record<string,number> = { bio:2000, firstName:200, lastName:200, firstNameEnglish:200,
  lastNameEnglish:200, certificateName:200, birthDate:200, phone:200, school:200, educationLevel:200 };
const arrays = ['interests','learningGoals'];
const object = (v:unknown):v is Record<string,unknown> => !!v && typeof v==='object' && !Array.isArray(v);
const length = (v:string) => Array.from(v).length;
@Injectable()
export class SelfProfilePatchPipe implements PipeTransform<unknown,SelfProfilePatch> {
  transform(value:unknown):SelfProfilePatch {
    if(!object(value))throw ApiException.validationFailed();
    const fields:ValidationField[]=[];
    for(const [key,v]of Object.entries(value)) {
      let valid=true;
      if(key==='display_name')valid=typeof v==='string'&&length(v)>=1&&length(v)<=80;
      else if(key==='username')valid=typeof v==='string'&&/^[A-Za-z0-9_.]{3,30}$/.test(v);
      else if(key==='avatar_url')valid=v===null||(typeof v==='string'&&length(v)<=2048);
      else if(key==='profile') {
        if(!object(v))valid=false;
        else for(const [name,item]of Object.entries(v)) {
          if(Object.prototype.hasOwnProperty.call(strings,name)) {
            if(item!==null&&(typeof item!=='string'||length(item)>strings[name]))fields.push({field:'profile.'+name,code:'invalid'});
          } else if(arrays.includes(name)) {
            if(!Array.isArray(item)||item.length>30||item.some(s=>typeof s!=='string'||length(s)>200))fields.push({field:'profile.'+name,code:'invalid'});
          } else fields.push({field:'profile.'+name,code:'unsupported'});
        }
      } else {fields.push({field:key,code:'unsupported'});continue;}
      if(!valid)fields.push({field:key,code:'invalid'});
    }
    if(fields.length)throw ApiException.validationFailed('ข้อมูลส่วนตัวไม่ถูกต้อง',{fields});
    return value as SelfProfilePatch;
  }
}
