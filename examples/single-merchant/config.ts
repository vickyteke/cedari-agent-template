import { defaultConfig } from '../../packages/config/src/defaults.ts';
import { defineAgentConfig } from '../../packages/config/src/schema.ts';
// Replace fixture IDs with the exact keys supplied by your Cedari integration.
export default defineAgentConfig({...defaultConfig,app:{...defaultConfig.app,slug:'studio-edit',scheme:'studioedit',iosBundleId:'com.example.studioedit',androidPackage:'com.example.studioedit'},id:'single-store',brand:{...defaultConfig.brand,name:'Studio Edit',agentName:'Studio'},assortment:{
 categories:{mode:'allowlist',ids:['Footwear']},merchants:{mode:'allowlist',ids:['mrc_example_store']},
 registry:{categories:[{id:'Footwear',label:'Footwear'}],merchants:[{id:'mrc_example_store',label:'Studio'}]}
},onboarding:{...defaultConfig.onboarding,fields:defaultConfig.onboarding.fields.map(f=>f.id==='style'?{...f,label:'Your style',options:[{id:'everyday',label:'Everyday essentials'},{id:'occasion',label:'Special occasions'}]}:f)}});
