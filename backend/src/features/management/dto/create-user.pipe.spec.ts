import { CreateUserPipe } from './create-user.pipe';
describe('Admin create canonical validation',()=>{
  const pipe=new CreateUserPipe(),valid={username:'New_User',password:'😀'.repeat(8),display_name:'Name'};
  it('retains valid fields and optional null/omitted email without adding authority',()=>{
    expect(pipe.transform(valid)).toEqual({...valid,email:undefined});expect(pipe.transform({...valid,email:null}).email).toBeNull();
  });
  it('rejects extra roles/verification/status/creator and invalid username/password',()=>{
    for(const value of [{...valid,roles:['admin']},{...valid,email_verified:true},{...valid,created_by:'actor'},
      {...valid,username:' new '},{...valid,password:'short'},{...valid,password:'😀'.repeat(129)},[],null])expect(()=>pipe.transform(value)).toThrow();
  });
  it('requires a nonempty display name and checks provided email without provider effects',()=>{
    for(const value of [{...valid,display_name:''},{...valid,email:'bad'},{...valid,email:'a@b.invalid '},{...valid,email:42}])expect(()=>pipe.transform(value)).toThrow();
    expect(pipe.transform({...valid,email:'Name@example.invalid'}).email).toBe('Name@example.invalid');
  });
});
