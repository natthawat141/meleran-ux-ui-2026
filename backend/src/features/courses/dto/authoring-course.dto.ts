import { Prisma } from '@prisma/client';
import { managedCourse,managementSelect,ManagedCourseDto } from './managed-course.dto';
import { storedItemType } from './course-detail.dto';

export const authoringSelect={...managementSelect,chapters:{orderBy:[{position:'asc'},{id:'asc'}],select:{id:true,title:true,description:true,
  items:{orderBy:[{position:'asc'},{id:'asc'}],select:{id:true,title:true,type:true,description:true,body:true,contentDoc:true,videoUrl:true,duration:true,readingMinutes:true,
    _count:{select:{progress:true}},transcript:{select:{itemId:true}},quiz:{select:{_count:{select:{questions:true,attempts:true}},
      questions:{orderBy:[{position:'asc'},{id:'asc'}],select:{id:true,type:true,prompt:true,options:true,maxScore:true}}}}}}}}} satisfies Prisma.CourseSelect;
export type AuthoringRow=Prisma.CourseGetPayload<{select:typeof authoringSelect}>;
export interface AuthoringQuestion {id:string;type:'single_choice'|'multiple_choice'|'essay'|'image';prompt:string;points:number;prompt_doc?:Prisma.JsonValue;
  rubric?:string|null;response_mode?:'image'|'text'|'either';options?:Array<{id:string;text:string}>;correct_option_ids?:string[]}
export interface AuthoringItem{id:string;type:'video'|'article'|'quiz';title:string;has_history:boolean;has_ai_transcript?:boolean;description?:string;
  body?:string;body_doc?:Prisma.JsonValue;video_url?:string;duration?:string;reading_minutes?:number;quiz?:{questions:AuthoringQuestion[];pass_percent:number}}
export interface AuthoringDto extends Omit<ManagedCourseDto,'chapters'>{chapters:Array<{id:string;title:string;description?:string;items:AuthoringItem[]}>}
export interface PreviewDto{id:string;title:string;revision:number;chapters:Array<{id:string;title:string;items:AuthoringItem[]}>}
const object=(v:unknown):v is Record<string,unknown> => !!v&&typeof v==='object'&&!Array.isArray(v);
interface StoredAuthoringQuestion{id:string;type:string;prompt:Prisma.JsonValue;options:Prisma.JsonValue;maxScore:Prisma.Decimal}
function questionView(q:StoredAuthoringQuestion,
  keys?:Map<string,Prisma.JsonValue>):AuthoringQuestion{
  if(!['single_choice','multiple_choice','essay','image'].includes(q.type))throw Error('Invalid stored question type');
  const meta=object(q.prompt)?q.prompt:null,prompt=typeof q.prompt==='string'?q.prompt:meta?.prompt;
  if(typeof prompt!=='string'||!q.maxScore.isFinite()||q.maxScore.isNegative()||!Number.isFinite(q.maxScore.toNumber()))throw Error('Invalid stored question');
  const result:AuthoringQuestion={id:q.id,type:q.type as AuthoringQuestion['type'],prompt,points:q.maxScore.toNumber()};
  if(meta&&Object.prototype.hasOwnProperty.call(meta,'prompt_doc'))result.prompt_doc=meta.prompt_doc as Prisma.JsonValue;
  if(meta&&Object.prototype.hasOwnProperty.call(meta,'rubric')){if(meta.rubric!==null&&typeof meta.rubric!=='string')throw Error('Invalid stored rubric');result.rubric=meta.rubric as string|null;}
  if(meta&&Object.prototype.hasOwnProperty.call(meta,'response_mode')){if(!['image','text','either'].includes(meta.response_mode as string))throw Error('Invalid response mode');result.response_mode=meta.response_mode as AuthoringQuestion['response_mode'];}
  if(['single_choice','multiple_choice'].includes(q.type)){
    if(!Array.isArray(q.options))throw Error('Invalid stored options');
    result.options=q.options.map(o=>{if(!object(o)||typeof o.id!=='string'||typeof o.text!=='string')throw Error('Invalid stored option');return {id:o.id,text:o.text};});
    if(new Set(result.options.map(o=>o.id)).size!==result.options.length)throw Error('Duplicate stored option');
    if(keys){const value=keys.get(q.id),ids=object(value)?value.option_ids:value;
      if(!Array.isArray(ids)||ids.some(id=>typeof id!=='string'||!result.options!.some(o=>o.id===id))||new Set(ids).size!==ids.length)throw Error('Invalid stored correct key');
      result.correct_option_ids=ids as string[];
    }
  }
  return result;
}
function chaptersView(row:AuthoringRow,keys?:Map<string,Prisma.JsonValue>):AuthoringDto['chapters']{
  return row.chapters.map(ch=>({id:ch.id,title:ch.title,...(ch.description!==null?{description:ch.description}:{}),items:ch.items.map(item=>{
    const type=storedItemType(item.type),result:AuthoringItem={id:item.id,title:item.title,type,has_history:item._count.progress>0||(item.quiz?._count.attempts??0)>0,
      ...(item.description!==null?{description:item.description}:{}),...(item.duration!==null?{duration:item.duration}:{}),...(item.readingMinutes!==null?{reading_minutes:item.readingMinutes}:{})};
    if(type==='video'){if(item.videoUrl!==null)result.video_url=item.videoUrl;result.has_ai_transcript=item.transcript!==null;}
    if(type==='article'){if(item.body!==null)result.body=item.body;if(item.contentDoc!==null)result.body_doc=item.contentDoc;}
    if(type==='quiz'){if(!item.quiz)throw Error('Missing stored quiz');result.quiz={questions:item.quiz.questions.map(q=>questionView(q,keys)),pass_percent:70};}
    return result;
  })}));
}
export function authoringView(row:AuthoringRow,keys?:Map<string,Prisma.JsonValue>):AuthoringDto{
  return {...managedCourse(row),chapters:chaptersView(row,keys)};
}
export function previewView(row:AuthoringRow):PreviewDto{
  if(row.revision<1)throw Error('Legacy revision requires explicit authoring proof');
  return {id:row.id,title:row.title,revision:row.revision,chapters:chaptersView(row).map(ch=>({id:ch.id,title:ch.title,items:ch.items}))};
}
