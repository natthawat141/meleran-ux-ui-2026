import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url);
function files(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(x=>x.isDirectory()?files(path.join(dir,x.name)):[path.join(dir,x.name)]);}
test('all runtime routes are independent of the removed prototype store',()=>{
 assert.equal(existsSync(new URL('packages/store',root)),false);
 for(const app of ['web','admin']) {
  for(const file of files(fileURLToPath(new URL('apps/'+app+'/src',root))).filter(f=>/\.[tj]sx?$/.test(f)))assert.doesNotMatch(readFileSync(file,'utf8'),/@melearn\/store|@legacy\/|useLms|stay-elearn-ux-v2|localStorage/);
  assert.doesNotMatch(readFileSync(new URL('apps/'+app+'/package.json',root),'utf8'),/@melearn\/store/);
 }
});
