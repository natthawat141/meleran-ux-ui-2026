import { Injectable,PipeTransform } from '@nestjs/common';
import { ApiException } from '../../../shared/errors/api-exception';
import { AnswerView } from './attempt-view';
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const invalid=()=>ApiException.validationFailed('ข้อมูลคำตอบหรือคะแนนไม่ถูกต้อง');
export interface SaveAnswers {answers:Record<string,AnswerView>}
export interface ManualGrade {score:number;comment:string|null}
export function validateImageUrl(value:string):boolean {
  return value.length<=2*1024*1024&&(!value||/^https:\/\/[^\s]+$/i.test(value)||/^\/(?!\/)[^\s]*$/.test(value)||/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value));
}
@Injectable() export class SaveAnswersPipe implements PipeTransform<unknown,SaveAnswers>{
  transform(v:unknown):SaveAnswers{
    if(!object(v)||Object.keys(v).some(k=>k!=='answers')||!object(v.answers))throw invalid();
    const entries:Array<[string,AnswerView]>=[];
    for(const [id,a] of Object.entries(v.answers)){
      if(!id||!object(a)||Object.keys(a).some(k=>!['option_ids','text','image_url'].includes(k)))throw invalid();
      const answer:AnswerView={};
      if(a.option_ids!==undefined){if(!Array.isArray(a.option_ids)||a.option_ids.some(x=>typeof x!=='string'||!x)||new Set(a.option_ids).size!==a.option_ids.length)throw invalid();answer.option_ids=a.option_ids as string[];}
      for(const k of ['text','image_url'] as const)if(a[k]!==undefined){if(typeof a[k]!=='string')throw invalid();answer[k]=a[k];}
      if(answer.image_url!==undefined&&!validateImageUrl(answer.image_url))throw invalid();
      entries.push([id,answer]);
    }
    return {answers:Object.fromEntries(entries)};
  }
}
@Injectable() export class ManualGradePipe implements PipeTransform<unknown,ManualGrade>{
  transform(v:unknown):ManualGrade{
    if(!object(v)||Object.keys(v).some(k=>!['score','comment'].includes(k))||typeof v.score!=='number'||!Number.isFinite(v.score)||
      v.score<0||!Number.isInteger(v.score*2)||!('comment'in v)||(v.comment!==null&&typeof v.comment!=='string'))throw invalid();
    return {score:v.score,comment:v.comment as string|null};
  }
}
