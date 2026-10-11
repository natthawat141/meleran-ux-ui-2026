/** Snapshot metadata controls manual answer mode; keys never enter this helper. */
export function answerComplete(type:string,response:unknown,responseMode?:unknown):boolean {
  if(!response||typeof response!=='object'||Array.isArray(response))return false;
  const r=response as Record<string,unknown>,filled=(v:unknown)=>typeof v==='string'&&v.trim().length>0;
  if(type==='single_choice'||type==='multiple_choice')return Array.isArray(r.option_ids)&&r.option_ids.length>0&&
    (type!=='single_choice'||r.option_ids.length===1)&&r.option_ids.every(x=>filled(x))&&new Set(r.option_ids).size===r.option_ids.length;
  if(type==='image')return filled(r.image_url);
  if(type!=='essay')throw Error('Invalid persisted question type');
  const mode=responseMode??'text';
  if(!['text','image','either'].includes(mode as string))throw Error('Invalid response mode');
  return mode==='text'?filled(r.text):mode==='image'?filled(r.image_url):filled(r.text)||filled(r.image_url);
}
