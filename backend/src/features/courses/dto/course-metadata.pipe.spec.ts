import { CourseMetadataPipe } from './course-metadata.pipe';
describe('course create boundary',()=>{
  it('maps omitted metadata explicitly and preserves zero/free, nullable and Unicode fields',()=>{
    expect(new CourseMetadataPipe().transform({title:'คอร์ส'})).toMatchObject({title:'คอร์ส',category:'',level:'',price:null,outcomes:[]});
    expect(new CourseMetadataPipe().transform({title:'😀'.repeat(120),price:{amount_minor:0,currency:'THB'},outcomes:['ผล']})).toMatchObject({price:{amount_minor:0,currency:'THB'}});
  });
  it('rejects owner/status/audit/AI injection and requires Admin Instructor target',()=>{
    for(const body of [{title:'test',status:'published'},{title:'test',instructor_id:'other'},{title:'test',ai_enabled:true},{title:'test',created_by:'other'},[]])
      expect(()=>new CourseMetadataPipe().transform(body)).toThrow();
    expect(()=>new CourseMetadataPipe(true).transform({title:'test'})).toThrow();
    expect(new CourseMetadataPipe(true).transform({title:'test',instructor_id:'target'}).instructor_id).toBe('target');
  });
  it('validates every exact request shape without numeric/string coercion',()=>{
    for(const body of [{title:''},{title:'x'.repeat(121)},{title:'test',category:null},{title:'test',price:{amount_minor:1,currency:'USD'}},
      {title:'test',price:{amount_minor:1.5,currency:'THB'}},{title:'test',outcomes:[1]},{title:'test',price:{amount_minor:1,currency:'THB',extra:true}}])
      expect(()=>new CourseMetadataPipe().transform(body)).toThrow();
  });
});
