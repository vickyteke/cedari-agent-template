import { readFile,writeFile } from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const file=new URL('../config/agent.ts',import.meta.url);
const original=await readFile(file,'utf8');
try{
 for(const preset of ['single-merchant','multi-category']){
  await writeFile(file,"export { default as agentConfig } from '../examples/"+preset+"/config.ts';\n");
  const result=spawnSync('npm',['exec','--workspace','apps/mobile','--','expo','export','--platform','web','--output-dir','../../output/presets/'+preset],{stdio:'inherit',env:{...process.env,CI:'1',OPENAI_API_KEY:'template-secret-sentinel-not-real'}});
  if(result.status!==0)throw Error('Preset export failed: '+preset);
 }
}finally{await writeFile(file,original);}
