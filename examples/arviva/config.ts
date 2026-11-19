import { defaultConfig } from '../../packages/config/src/defaults.ts';
import { defineAgentConfig } from '../../packages/config/src/schema.ts';
export default defineAgentConfig({...defaultConfig,id:'arviva-example',assortment:{categories:{mode:'allowlist',ids:['Rugs','Wall Art','Lighting','Furniture']},merchants:{mode:'all'},registry:{categories:[{id:'Rugs',label:'Rugs'},{id:'Wall Art',label:'Wall art'},{id:'Lighting',label:'Lighting'},{id:'Furniture',label:'Furniture'}],merchants:[]}}});
