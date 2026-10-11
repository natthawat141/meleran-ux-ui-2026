import { decodeCursor, encodeCursor, PageQueryPipe } from '../../src/shared/pagination/keyset';

describe('shared signed keyset protocol',()=>{
  const pipe=new PageQueryPipe(['q','category']);
  const query=pipe.transform({limit:'2',q:'  Thai  '});
  const point={id:'row-id',at:new Date('2026-10-11T00:00:00.000Z')};
  it('normalizes only the chosen search field and defaults the declared limit',()=>{
    expect(query).toEqual({limit:2,cursor:undefined,filters:{q:'Thai'}});
    expect(pipe.transform({category:' Exact '})).toEqual({limit:20,cursor:undefined,filters:{category:' Exact '}});
  });
  it('round trips and binds route, actor, filters and limit',()=>{
    const cursor=encodeCursor('route',query,point,'owner');
    expect(decodeCursor('route',{...query,cursor},'owner')).toEqual(point);
    for(const [route,q,owner] of [['other',query,'owner'],['route',{...query,limit:3},'owner'],
      ['route',{...query,filters:{q:'other'}},'owner'],['route',query,'other']] as const)
      expect(()=>decodeCursor(route,{...q,cursor},owner)).toThrow();
  });
  it('rejects modified/noncanonical/oversized query input without coercion',()=>{
    for(const input of [{limit:'2.0'},{limit:'0'},{limit:'51'},{limit:'02'},{limit:['2','3']},
      {q:{contains:'secret'}},{role:'admin'},{cursor:''},{cursor:'a'.repeat(4097)},null,[]])expect(()=>pipe.transform(input)).toThrow();
    const cursor=encodeCursor('route',query,point);
    for(const value of [cursor.slice(0,-2)+'XX',cursor+'.extra','o:1','!!','1'])expect(()=>decodeCursor('route',{...query,cursor:value})).toThrow();
  });
  it('invalidates tokens on key rotation and requires a production key',()=>{
    const old=process.env.CURSOR_SIGNING_SECRET,mode=process.env.NODE_ENV;
    try {
      process.env.CURSOR_SIGNING_SECRET='test-key-a-'.repeat(5);
      const cursor=encodeCursor('route',query,point);
      process.env.CURSOR_SIGNING_SECRET='test-key-b-'.repeat(5);
      expect(()=>decodeCursor('route',{...query,cursor})).toThrow();
      delete process.env.CURSOR_SIGNING_SECRET;process.env.NODE_ENV='production';
      expect(()=>encodeCursor('route',query,point)).toThrow();
    } finally {
      if(old===undefined)delete process.env.CURSOR_SIGNING_SECRET;else process.env.CURSOR_SIGNING_SECRET=old;
      if(mode===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=mode;
    }
  });
});
