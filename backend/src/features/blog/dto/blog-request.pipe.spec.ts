import { BlogRequestPipe,checkedDocument,safeContentUrl } from './blog-request.pipe';
describe('Blog canonical requests and rich-content trust boundary',()=>{
  it('preserves omitted vs null, rich structure, Unicode limits and revision-only commands',()=>{
    const rich={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'ไทย😀'}]}]};
    expect(new BlogRequestPipe('create').transform({title:'บทความ',slug:'thai-post',content:'',content_doc:rich})).toEqual({title:'บทความ',slug:'thai-post',content:'',content_doc:rich});
    expect(new BlogRequestPipe('patch').transform({expected_revision:2,excerpt:null,content_doc:null})).toEqual({expected_revision:2,excerpt:null,content_doc:null});
    expect(new BlogRequestPipe('revision').transform({expected_revision:1})).toEqual({expected_revision:1});
  });
  it('rejects audit/status injection and malformed revisions before persistence',()=>{
    for(const input of [{expected_revision:0},{expected_revision:1.5},{expected_revision:'1'},{expected_revision:1,editor_id:'actor'},{expected_revision:1,status:'published'}])
      expect(()=>new BlogRequestPipe('patch').transform(input)).toThrow();
    expect(()=>new BlogRequestPipe('create').transform({title:'',slug:'valid-slug',content:'body'})).toThrow();
    expect(()=>new BlogRequestPipe('create').transform({title:'T',slug:'UPPER',content:'body'})).toThrow();
  });
  it('rejects unsafe URLs/prototype keys and accepts existing safe image/link formats',()=>{
    for(const url of ['javascript:alert(1)','//evil.test/x','data:text/html;base64,AAAA','https://ok.test\n'])expect(safeContentUrl(url,true)).toBe(false);
    for(const url of ['https://example.test/image.png','/assets/image.png','data:image/png;base64,AAAA'])expect(safeContentUrl(url,true)).toBe(true);
    for(const attrs of [{src:'javascript:alert(1)'},{href:'data:text/html,evil'},{onclick:'alert(1)'}])
      expect(()=>checkedDocument({type:'doc',content:[{type:'image',attrs}]})).toThrow();
    expect(()=>checkedDocument(JSON.parse('{"type":"doc","__proto__":{}}'))).toThrow();
  });
  it('bounds document traversal and encoded storage size without losing null semantics',()=>{
    expect(checkedDocument(null)).toBeNull();expect(()=>checkedDocument('raw')).toThrow();
    let deep:unknown={type:'text',text:'x'};for(let i=0;i<35;i++)deep={content:[deep]};
    expect(()=>checkedDocument({type:'doc',content:[deep]})).toThrow();
    expect(()=>checkedDocument({type:'doc',content:Array(20001).fill(null)})).toThrow();
    expect(()=>checkedDocument({type:'doc',text:'x'.repeat(2*1024*1024)})).toThrow();
  });
});
