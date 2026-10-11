import { PipeTransform } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ApiException } from '../../../shared/errors/api-exception';
import { CourseMetadata,CourseMetadataPipe } from './course-metadata.pipe';

export interface QuestionWrite {id?:string;type:'single_choice'|'multiple_choice'|'essay'|'image';prompt:string;points:number;
  prompt_doc?:Prisma.InputJsonValue|null;rubric?:string|null;response_mode?:'text'|'image'|'either';options?:Array<{id?:string;text:string}>;correct_option_indices?:number[]}
export interface ItemWrite {id?:string;type:'video'|'article'|'quiz';title:string;description?:string;body?:string;body_doc?:Prisma.InputJsonValue|null;
  video_url?:string;duration?:string;reading_minutes?:number;quiz?:{questions:QuestionWrite[];pass_percent:70}}
export interface ChapterWrite {id?:string;title:string;description?:string;items:ItemWrite[]}
export interface CoursePatch extends Partial<CourseMetadata>{expected_revision:number;chapters?:ChapterWrite[]}
const invalid=()=>ApiException.validationFailed('ข้อมูลคอร์สหรือโครงสร้างบทไม่ถูกต้อง');
function record(v:unknown,keys:string[]):Record<string,unknown>{
  if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!keys.includes(k)))throw invalid();return v as Record<string,unknown>;
}
function string(v:unknown):void{if(typeof v!=='string')throw invalid();}
function optional(v:Record<string,unknown>,keys:string[]){for(const k of keys)if(k in v)string(v[k]);}
function json(value:unknown):void{
  if(value===null)return;
  if(!value||typeof value!=='object'||Array.isArray(value)||(value as Record<string,unknown>).type!=='doc')throw invalid();
  let visited=0;
  const visit=(v:unknown,depth:number):void=>{
    if(++visited>20000||depth>30)throw invalid();if(v===null||typeof v==='string'||typeof v==='boolean')return;
    if(typeof v==='number'&&Number.isFinite(v))return;
    if(Array.isArray(v)){for(const x of v)visit(x,depth+1);return;}
    if(v&&typeof v==='object'){for(const [k,x]of Object.entries(v)){
      if(['__proto__','constructor','prototype'].includes(k)||['href','src'].includes(k)&&typeof x==='string'&&!/^(https?:\/\/|\/(?!\/)|data:image\/(png|jpeg|webp);base64,)/i.test(x))throw invalid();
      visit(x,depth+1);
    }return;}throw invalid();
  };
  visit(value,0);if(JSON.stringify(value).length>2000000)throw invalid();
}
function list(v:unknown):unknown[]{if(!Array.isArray(v)||v.length>1000)throw invalid();return v;}
function question(input:unknown):QuestionWrite{
  const v=record(input,['id','type','prompt','points','prompt_doc','rubric','response_mode','options','correct_option_indices']);
  optional(v,['id']);if(!['single_choice','multiple_choice','essay','image'].includes(v.type as string))throw invalid();string(v.prompt);
  if(typeof v.points!=='number'||!Number.isFinite(v.points)||v.points<0)throw invalid();
  // Existing numeric(65,30) storage: reject unrepresentable input rather than silently round it.
  const score=new Prisma.Decimal(v.points);if(score.decimalPlaces()>30||score.greaterThanOrEqualTo('1e35'))throw invalid();
  if('prompt_doc'in v)json(v.prompt_doc);if('rubric'in v&&v.rubric!==null)string(v.rubric);
  if('response_mode'in v&&!['text','image','either'].includes(v.response_mode as string))throw invalid();
  if('options'in v)for(const option of list(v.options)){const o=record(option,['id','text']);string(o.text);optional(o,['id']);}
  if('correct_option_indices'in v){const indices=list(v.correct_option_indices);
    if(indices.some(i=>!Number.isInteger(i)||(i as number)<0||(i as number)>=(Array.isArray(v.options)?v.options.length:0))||new Set(indices).size!==indices.length)throw invalid();
    if(v.type==='single_choice'&&indices.length>1)throw invalid();
  }
  if(!['single_choice','multiple_choice'].includes(v.type as string)&&('options'in v||'correct_option_indices'in v))throw invalid();
  return v as unknown as QuestionWrite;
}
function item(input:unknown):ItemWrite{
  const v=record(input,['id','type','title','description','body','body_doc','video_url','duration','reading_minutes','quiz']);
  if(!['video','article','quiz'].includes(v.type as string))throw invalid();string(v.title);optional(v,['id','description','body','video_url','duration']);
  if('body_doc'in v)json(v.body_doc);
  if('reading_minutes'in v&&(typeof v.reading_minutes!=='number'||!Number.isFinite(v.reading_minutes)||v.reading_minutes<0))throw invalid();
  if(v.type!=='article'&&('body'in v||'body_doc'in v)||v.type!=='video'&&'video_url'in v||v.type!=='quiz'&&'quiz'in v)throw invalid();
  if('quiz'in v){const q=record(v.quiz,['questions','pass_percent']);if(q.pass_percent!==70)throw invalid();v.quiz={questions:list(q.questions).map(question),pass_percent:70};}
  return v as unknown as ItemWrite;
}
export class CoursePatchPipe implements PipeTransform<unknown,CoursePatch>{
  transform(input:unknown):CoursePatch{
    const metadataKeys=['title','subtitle','description','cover_url','category','level','price','outcomes'];
    const v=record(input,['expected_revision','instructor_id','chapters',...metadataKeys]);
    if(!Number.isSafeInteger(v.expected_revision)||(v.expected_revision as number)<1)throw invalid();
    optional(v,['instructor_id']);
    const metadataInput:Record<string,unknown>={title:'_'};for(const key of metadataKeys)if(key in v)metadataInput[key]=v[key];
    const metadata=new CourseMetadataPipe().transform(metadataInput),result:Record<string,unknown>={expected_revision:v.expected_revision};
    for(const key of metadataKeys)if(key in v)result[key]=metadata[key as keyof CourseMetadata];
    if('instructor_id'in v)result.instructor_id=v.instructor_id;
    if('chapters'in v)result.chapters=list(v.chapters).map(chapter=>{
      const ch=record(chapter,['id','title','description','items']);string(ch.title);optional(ch,['id','description']);return {...ch,items:list(ch.items).map(item)};
    });
    return result as unknown as CoursePatch;
  }
}
export class ReviewRevisionPipe implements PipeTransform<unknown,{expected_revision:number}>{
  transform(input:unknown){const v=record(input,['expected_revision']);if(!Number.isSafeInteger(v.expected_revision)||(v.expected_revision as number)<1)throw invalid();return {expected_revision:v.expected_revision as number};}
}
export class ReviewReturnPipe implements PipeTransform<unknown,{reason:string}>{
  transform(input:unknown){const v=record(input,['reason']);if(typeof v.reason!=='string'||!v.reason.trim())throw invalid();return {reason:v.reason};}
}
export class EmptyCourseCommandPipe implements PipeTransform<unknown,Record<string,never>>{
  transform(input:unknown){record(input,[]);return {};}
}
