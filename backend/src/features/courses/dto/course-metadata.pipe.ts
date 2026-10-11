import { PipeTransform } from '@nestjs/common';
import { ApiException } from '../../../shared/errors/api-exception';

export interface CourseMetadata {title:string;subtitle:string|null;description:string|null;cover_url:string|null;category:string;level:string;
  price:{amount_minor:number;currency:'THB'}|null;outcomes:string[];instructor_id?:string}
const invalid=()=>ApiException.validationFailed('ข้อมูลคอร์สไม่ถูกต้อง');
export class CourseMetadataPipe implements PipeTransform<unknown,CourseMetadata>{
  constructor(private readonly admin=false){}
  transform(value:unknown):CourseMetadata{
    if(!value||typeof value!=='object'||Array.isArray(value))throw invalid();const v=value as Record<string,unknown>;
    const allowed=['title','subtitle','description','cover_url','category','level','price','outcomes',...(this.admin?['instructor_id']:[])];
    if(Object.keys(v).some(k=>!allowed.includes(k)))throw invalid();
    const text=(key:string,max:number,required=false,nullable=false):string|null|undefined=>{
      const value=v[key];if(value===undefined&&!required)return undefined;if(value===null&&nullable)return null;
      if(typeof value!=='string'||[...value].length>max||(required&&value.length===0))throw invalid();return value;
    };
    const title=text('title',120,true) as string,subtitle=text('subtitle',240,false,true),description=text('description',20000,false,true),cover=text('cover_url',2000000,false,true);
    const category=text('category',80),level=text('level',80),instructor=this.admin?text('instructor_id',Number.MAX_SAFE_INTEGER,true):undefined;
    let price:CourseMetadata['price']=null;
    if(v.price!==undefined&&v.price!==null){
      if(typeof v.price!=='object'||Array.isArray(v.price))throw invalid();const p=v.price as Record<string,unknown>;
      if(Object.keys(p).length!==2||p.currency!=='THB'||!Number.isInteger(p.amount_minor)||(p.amount_minor as number)<0||(p.amount_minor as number)>2147483647)throw invalid();
      price={amount_minor:p.amount_minor as number,currency:'THB'};
    }
    if(v.outcomes!==undefined&&(!Array.isArray(v.outcomes)||v.outcomes.some(x=>typeof x!=='string')))throw invalid();
    return {title,subtitle:subtitle??null,description:description??null,cover_url:cover??null,category:category as string??'',level:level as string??'',price,
      outcomes:(v.outcomes??[]) as string[],...(this.admin?{instructor_id:instructor as string}:{})};
  }
}
