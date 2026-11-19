import { defaultConfig } from '../../packages/config/src/defaults.ts';
import { defineAgentConfig } from '../../packages/config/src/schema.ts';
export default defineAgentConfig({...defaultConfig,app:{...defaultConfig.app,slug:'personal-edit',scheme:'personaledit',iosBundleId:'com.example.personaledit',androidPackage:'com.example.personaledit'},id:'personal-edit',brand:{...defaultConfig.brand,name:'The Personal Edit',agentName:'Edit'},assortment:{
 categories:{mode:'allowlist',ids:['Apparel','Beauty']},merchants:{mode:'allowlist',ids:['mrc_example_one','mrc_example_two']},
 registry:{categories:[{id:'Apparel',label:'Apparel'},{id:'Beauty',label:'Beauty'}],merchants:[{id:'mrc_example_one',label:'One'},{id:'mrc_example_two',label:'Two'}]}
}});
