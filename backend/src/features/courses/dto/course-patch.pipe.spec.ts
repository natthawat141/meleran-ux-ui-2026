import { CoursePatchPipe,ReviewRevisionPipe,ReviewReturnPipe,EmptyCourseCommandPipe } from './course-patch.pipe';
describe('authoring command validation / canonical omission and protected fields',()=>{
  const pipe=new CoursePatchPipe();
  const body=(points=3.75)=>({expected_revision:1,chapters:[{title:'chapter',items:[{type:'quiz',title:'quiz',quiz:{pass_percent:70,
    questions:[{type:'single_choice',prompt:'question',points,options:[{text:'a'},{text:'b'}],correct_option_indices:[0]}]}}]}]});
  it('keeps omitted metadata omitted and preserves explicit null rather than clearing unrelated fields',()=>{
    expect(pipe.transform({expected_revision:1,description:null})).toEqual({expected_revision:1,description:null});
    expect(pipe.transform({expected_revision:1,price:null,outcomes:[]})).toEqual({expected_revision:1,price:null,outcomes:[]});
  });
  it('rejects Admin-only AI/transcript/audit fields and unknown nested fields',()=>{
    for(const field of ['ai_enabled','transcript','created_by','status','published_by'])expect(()=>pipe.transform({expected_revision:1,[field]:'x'})).toThrow();
    expect(()=>pipe.transform({expected_revision:1,chapters:[{title:'ch',items:[{type:'article',title:'a',correct_key:'private'}]}]})).toThrow();
  });
  it('preserves fractional points and rejects silent numeric storage rounding/overflow',()=>{
    expect(pipe.transform(body()).chapters![0].items[0].quiz!.questions[0].points).toBe(3.75);
    for(const score of [-1,Infinity,NaN,1e35,1e-31])expect(()=>pipe.transform(body(score))).toThrow();
  });
  it('choice indices must be integer, in-range, unique and match fixed pass70',()=>{
    for(const indices of [[0.5],[-1],[2],[0,0],[0,1]]){const v=body();v.chapters[0].items[0].quiz.questions[0].correct_option_indices=indices;expect(()=>pipe.transform(v)).toThrow();}
    const v=body();v.chapters[0].items[0].quiz.pass_percent=80;expect(()=>pipe.transform(v)).toThrow();
  });
  it('accepts active Tiptap/null Draft format while rejecting unsafe URLs, prototype keys and excessive recursion',()=>{
    expect(pipe.transform({expected_revision:1,chapters:[{title:'ch',items:[{type:'article',title:'a',body_doc:null}]}]}).chapters![0].items[0].body_doc).toBeNull();
    let deep:unknown={};for(let i=0;i<32;i++)deep={child:deep};
    for(const doc of [{type:'doc',content:[deep]},JSON.parse('{"type":"doc","__proto__":{"pollute":true}}'),
      {type:'doc',content:[{type:'image',attrs:{src:'javascript:alert(1)'}}]},true])
      expect(()=>pipe.transform({expected_revision:1,chapters:[{title:'ch',items:[{type:'article',title:'a',body_doc:doc}]}]})).toThrow();
  });
  it('revision commands are positive safe integers and forbid silently added fields',()=>{
    const revision=new ReviewRevisionPipe();expect(revision.transform({expected_revision:2})).toEqual({expected_revision:2});
    for(const v of [{},{expected_revision:1.5},{expected_revision:0},{expected_revision:2,reason:'extra'}])expect(()=>revision.transform(v)).toThrow();
  });
  it('return reason must be nonblank, while publication retains canonical empty request',()=>{
    expect(new ReviewReturnPipe().transform({reason:'แก้คำอธิบาย'})).toEqual({reason:'แก้คำอธิบาย'});
    expect(()=>new ReviewReturnPipe().transform({reason:' '})).toThrow();expect(new EmptyCourseCommandPipe().transform({})).toEqual({});
    expect(()=>new EmptyCourseCommandPipe().transform({expected_revision:1})).toThrow();
  });
});
