import { messageMetadata, projectPractice } from './message-history.dto';
import { ConversationCreatePipe } from './conversation-create.pipe';
describe('AI history bounded projection and request validation',()=>{
  const metadata={version:1,request_id:'request',kind:'text',status:'succeeded',completed_at:'2026-10-11T00:00:00.000Z',error_code:null};
  it('selects only declared wire metadata and refuses unknown or incomplete legacy states',()=>{
    expect(messageMetadata({...metadata,private:'PRIVATE'})).toEqual(metadata);
    for(const v of [null,{}, {...metadata,request_id:null},{...metadata,status:'other'},
      {...metadata,completed_at:null},{...metadata,status:'pending'},{...metadata,completed_at:'yesterday'}])expect(()=>messageMetadata(v)).toThrow();
  });
  it('does not disclose practice keys/explanations before answering and uses persisted latest answers',()=>{
    const payload={version:1,questions:[{id:'q',prompt:'P',options:[{id:'a',text:'A'},{id:'b',text:'B'}],correct_option_id:'a',explanation:'PRIVATE_UNTIL_ANSWERED'}]};
    expect(JSON.stringify(projectPractice('practice',payload,{}))).not.toMatch(/correct_option_id|PRIVATE_UNTIL/);
    expect(projectPractice('practice',payload,{q:{option_id:'b',answered_at:metadata.completed_at}}).questions[0]).toMatchObject({
      answered:true,my_option_id:'b',result:{correct:false,explanation:'PRIVATE_UNTIL_ANSWERED'}});
  });
  it('validates create Unicode limits/unknown keys without claiming user identity from input',()=>{
    const pipe=new ConversationCreatePipe();expect(pipe.transform({})).toEqual({title:undefined,course_id:undefined});
    expect(pipe.transform({title:'😀'.repeat(80)}).title).toBe('😀'.repeat(80));
    for(const v of [{title:'😀'.repeat(81)},{title:null},{title:' '},{course_id:''},{course_id:null},{user_id:'other'},[]])expect(()=>pipe.transform(v)).toThrow();
  });
});
