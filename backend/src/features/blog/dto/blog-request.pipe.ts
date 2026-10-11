import { PipeTransform } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ApiException } from '../../../shared/errors/api-exception';

export interface BlogWrite {title?:string;slug?:string;category?:string;cover_url?:string|null;excerpt?:string|null;content?:string;content_doc?:Prisma.InputJsonValue|null;expected_revision?:number}
const invalid=()=>ApiException.validationFailed('ข้อมูลบทความไม่ถูกต้อง');
export function safeContentUrl(value:string,image=false):boolean {
  if(!value||value!==value.trim()||/[\u0000-\u0020\u007f]/.test(value))return false;
  if(value.startsWith('/')&&!value.startsWith('//'))return !value.includes('\\');
  if(image&&/^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/.test(value))return true;
  try{return ['http:','https:'].includes(new URL(value).protocol);}catch{return false;}
}
export function checkedDocument(value:unknown):Prisma.InputJsonValue|null {
  if(value===null)return null;
  if(!value||typeof value!=='object'||Array.isArray(value)||(value as Record<string,unknown>).type!=='doc')throw invalid();
  if(Buffer.byteLength(JSON.stringify(value),'utf8')>2*1024*1024)throw invalid();
  let visited=0;
  const visit=(node:unknown,depth:number):void=>{
    if(++visited>20000||depth>30)throw invalid();
    if(node===null||typeof node==='string'||typeof node==='boolean')return;
    if(typeof node==='number'){if(!Number.isFinite(node))throw invalid();return;}
    if(Array.isArray(node)){for(const child of node)visit(child,depth+1);return;}
    if(!node||typeof node!=='object')throw invalid();
    for(const[key,child]of Object.entries(node)){
      if(['__proto__','constructor','prototype'].includes(key)||/^on[a-z]+$/i.test(key))throw invalid();
      if((key==='href'||key==='src')&&(typeof child!=='string'||!safeContentUrl(child,key==='src')))throw invalid();
      visit(child,depth+1);
    }
  };visit(value,0);return value as Prisma.InputJsonValue;
}
export class BlogRequestPipe implements PipeTransform<unknown,BlogWrite>{
  constructor(private readonly mode:'create'|'patch'|'revision'){}
  transform(value:unknown):BlogWrite {
    if(!value||typeof value!=='object'||Array.isArray(value))throw invalid();const v=value as Record<string,unknown>;
    const fields=this.mode==='revision'?['expected_revision']:['title','slug','category','cover_url','excerpt','content','content_doc',...(this.mode==='patch'?['expected_revision']:[])];
    if(Object.keys(v).some(k=>!fields.includes(k)))throw invalid();
    if(this.mode!=='create'&&(!Number.isSafeInteger(v.expected_revision)||(v.expected_revision as number)<1))throw invalid();
    const result:BlogWrite={};
    for(const[k,max]of [['title',120],['slug',80],['category',40],['cover_url',2000000],['excerpt',2000],['content',200000]] as const){
      const x=v[k];if(x===undefined){if(this.mode==='create'&&['title','slug','content'].includes(k))throw invalid();continue;}
      if(x===null&&['cover_url','excerpt'].includes(k)){(result as Record<string,unknown>)[k]=null;continue;}
      if(typeof x!=='string'||[...x].length>max||(k==='title'&&x.length<1)||(k==='slug'&&!/^[a-z0-9-]{3,80}$/.test(x)))throw invalid();
      if(k==='cover_url'&&x!==''&&!safeContentUrl(x,true))throw invalid();(result as Record<string,unknown>)[k]=x;
    }
    if(Object.prototype.hasOwnProperty.call(v,'content_doc'))result.content_doc=checkedDocument(v.content_doc);
    if(this.mode!=='create')result.expected_revision=v.expected_revision as number;
    return result;
  }
}
