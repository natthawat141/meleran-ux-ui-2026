import { practiceAnswers, practiceSnapshot } from '../practice-snapshot';

export interface MessageWireMetadata {
  version:1;request_id:string;kind:'text'|'practice_set';status:'pending'|'succeeded'|'failed';completed_at:string|null;error_code:string|null;
}
export interface PracticeHistory {topic_id:string;questions:Array<{id:string;prompt:string;options:Array<{id:string;text:string}>;
  answered:boolean;my_option_id?:string;result?:{correct:boolean;explanation:string}}>}
export interface MessageHistoryDto extends Omit<MessageWireMetadata,'version'> {
  id:string;role:'user'|'assistant';content:string;created_at:string;practice:PracticeHistory|null;
}
export function messageMetadata(value:unknown):MessageWireMetadata {
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Missing message wire metadata');
  const v=value as Record<string,unknown>;
  if(v.version!==1||typeof v.request_id!=='string'||!v.request_id||!['text','practice_set'].includes(v.kind as string)||
    !['pending','succeeded','failed'].includes(v.status as string)||(v.error_code!==null&&typeof v.error_code!=='string')||
    (v.completed_at!==null&&(typeof v.completed_at!=='string'||!Number.isFinite(Date.parse(v.completed_at))||new Date(v.completed_at).toISOString()!==v.completed_at)))
    throw Error('Invalid stored message wire metadata');
  if((v.status==='pending'&&v.completed_at!==null)||(v.status==='succeeded'&&(v.completed_at===null||v.error_code!==null)))throw Error('Invalid message lifecycle');
  return {version:1,request_id:v.request_id,kind:v.kind as MessageWireMetadata['kind'],status:v.status as MessageWireMetadata['status'],
    completed_at:v.completed_at as string|null,error_code:v.error_code as string|null};
}
export function projectPractice(id:string,payload:unknown,answerData:unknown):PracticeHistory {
  const questions=practiceSnapshot(payload),answers=practiceAnswers(questions,answerData);
  return {topic_id:id,questions:questions.map(q=>{
    const answer=answers.get(q.id);
    return {id:q.id,prompt:q.prompt,options:q.options,answered:!!answer,...(answer?{my_option_id:answer.option_id,
      result:{correct:answer.option_id===q.correct_option_id,explanation:q.explanation}}:{})};
  })};
}
