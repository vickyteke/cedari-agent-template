import {defaultConfig} from '../../packages/config/src/defaults.ts';
import {defineAgentConfig} from '../../packages/config/src/schema.ts';
export default defineAgentConfig({
 ...defaultConfig,
 id:'minimal-agent',
 brand:{...defaultConfig.brand,name:'The Essential Edit',agentName:'Edit'},
 features:{uploads:false,saved:false,comparison:false,checkout:false,email:false,analytics:false,roomPreviews:false},
 agent:{...defaultConfig.agent,photoWorkflows:[]},
 navigation:{initialTab:'discover',tabs:defaultConfig.navigation.tabs.filter(tab=>['chat','discover','profile'].includes(tab.id))},
 onboarding:{...defaultConfig.onboarding,enabled:false}
});
