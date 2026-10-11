import { SaveAnswersPipe,ManualGradePipe } from './assessment-write.pipe';
describe('Assessment Draft request boundaries',()=>{
  const answers=new SaveAnswersPipe(),grade=new ManualGradePipe();
  it('accepts empty draft and prototype-named question IDs without prototype mutation',()=>{
    const body=JSON.parse('{"answers":{"__proto__":{"text":"answer"}}}');expect(answers.transform(body).answers.__proto__).toEqual({text:'answer'});expect({}).not.toHaveProperty('text');
    expect(answers.transform({answers:{}})).toEqual({answers:{}});
  });
  it.each([{answers:null},{answers:[],score:100},{answers:{q:{score:100}}},{answers:{q:{option_ids:['x','x']}}},{answers:{q:{image_url:'//evil.test/x'}}},
    {answers:{q:{image_url:'data:image/svg+xml;base64,YQ=='}}}])('rejects injected or unsafe answer structure',body=>expect(()=>answers.transform(body)).toThrow());
  it('preserves explicit nullable comment and fractional half-point grade',()=>expect(grade.transform({score:0.5,comment:null})).toEqual({score:0.5,comment:null}));
  it.each([{score:1},{score:0.25,comment:null},{score:-0.5,comment:'x'},{score:1,comment:null,passed:true}])('rejects missing comment,noncanonical grade step and result claims',body=>expect(()=>grade.transform(body)).toThrow());
});
