import { mkdtemp, readdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { contract, findOperation, schemaValidator } from '../tests/support/contract-validator.mjs';

// Regenerate examples from in-memory fake accounts, never a browser or real backend.
const directory=await mkdtemp(join(tmpdir(),'melearn-contract-fixtures-'));
try {
  const result=spawnSync(process.execPath,['--test'],{
    env:{...process.env,MELEARN_CONTRACT_FIXTURES:directory},encoding:'utf8',maxBuffer:8_000_000,
  });
  if (result.status!==0) { process.stdout.write(result.stdout); process.stderr.write(result.stderr); throw new Error('Fixture tests failed'); }
  let count=0;
  for(const file of (await readdir(directory)).sort()) {
    for(const line of (await readFile(join(directory,file),'utf8')).trim().split('\n')) {
      if(!line)continue;
      const sample=JSON.parse(line),operation=findOperation(sample.method,sample.path);
      if(!operation)continue;
      const response=operation.responses[sample.status]?.content?.['application/json'];
      // Prefer the smallest validated fixture for a readable backend handoff.
      if(response && (response.example===undefined || JSON.stringify(sample.response).length<JSON.stringify(response.example).length)) response.example=sample.response;
      if(sample.status>=200 && sample.status<300 && sample.request!==undefined) {
        let request=sample.request;
        if(typeof request==='string') { try {request=JSON.parse(request);} catch {continue;} }
        const body=operation.requestBody?.content?.['application/json'];
        if(body && schemaValidator(body.schema)(request) && (body.example===undefined || JSON.stringify(request).length<JSON.stringify(body.example).length))body.example=request;
      }
      count++;
    }
  }
  await writeFile('packages/contracts/openapi/openapi.json',JSON.stringify(contract,null,2)+'\n');
  console.log(`Examples updated from ${count} schema-checked synthetic responses. No headers/cookies recorded.`);
} finally { await rm(directory,{recursive:true,force:true}); }
