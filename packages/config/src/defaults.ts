import type { AgentConfig } from './schema.ts';
export const defaultConfig: AgentConfig = {
  schemaVersion:1,id:'premium-agent',locale:'en',
  brand:{name:'Arviva Space',agentName:'Arviva',company:'Cedari AI',attribution:false,website:'https://example.com',supportEmail:'hello@example.com',privacyUrl:'https://example.com/privacy',termsUrl:'https://example.com/terms'},
  theme:{
    colors:{paper:'#f7f2eb',ink:'#27221f',accent:'#8a624a',muted:'#7b7168',line:'#dfd6ca',white:'#fffcf8',soft:'#ebe3d8',green:'#53634c',error:'#9e3d30',teal:'#193e3a',tabActive:'rgba(138,98,74,0.14)',tabInk:'#684b39',tabMuted:'#665e57'},
    fonts:{heading:'Georgia',body:'System'},typeScale:1,spacingScale:1,radiusScale:1,borderWidth:1,shadowOpacity:0.12,iconStrokeWidth:1.5,
    motion:{enabled:true,duration:240,compactScale:0.75},navigation:{height:56,radius:32,maxWidth:460},button:{minHeight:49,radius:28},card:{radius:20}
  },
  navigation:{initialTab:'chat',tabs:[{id:'chat',enabled:true,label:'Chat',icon:'chat'},{id:'discover',enabled:true,label:'Discover',icon:'discover'},{id:'saved',enabled:true,label:'Saved',icon:'heart'},{id:'bag',enabled:true,label:'Bag',icon:'bag'},{id:'profile',enabled:true,label:'You',icon:'user'}]},
  onboarding:{enabled:true,version:1,skippable:true,slides:[
    {id:'welcome',eyebrow:'YOUR PERSONAL SHOPPING COMPANION',title:'Distinctive finds.\nEntirely you.',body:'Discover considered pieces, thoughtful details and possibilities that feel like you.',image:'inspiration',fields:[],button:'Find my inspiration'},
    {id:'possibilities',eyebrow:'A PERSONAL EDIT',title:'More possibilities.\nA thoughtful selection.',body:'Tell your companion what you have in mind. Explore a few carefully chosen recommendations from the connected merchants.',image:'inspiration',fields:[],button:'Make it personal'},
    {id:'preferences',eyebrow:'FOLLOW YOUR INSTINCT',title:'What are you\ndrawn to?',body:'Share a little about your preferences. You can refine them whenever you like.',fields:['style'],button:'Continue'},
    {id:'personal',eyebrow:'LET’S MAKE IT PERSONAL',title:'Your taste.\nYour point of view.',body:'A few details help make your discoveries feel more like you. No account needed.',fields:['name','preferences'],button:'Explore my edit'}
  ],fields:[
    {id:'style',label:'Your style',type:'multiple',required:false,options:[{id:'minimal',label:'Warm Minimalism'},{id:'organic',label:'Modern Organic'},{id:'eclectic',label:'Collected & Eclectic'},{id:'classic',label:'Timeless Classic'},{id:'contemporary',label:'Sculptural Contemporary'}]},
    {id:'name',label:'What should I call you?',type:'text',required:false,maxLength:80,placeholder:'Your first name'},
    {id:'preferences',label:'Tell me about your preferences',type:'text',required:false,maxLength:900,placeholder:'Colors, materials, styles and details you love…'}
  ]},
  features:{uploads:true,saved:true,comparison:true,checkout:true,email:false,analytics:false,roomPreviews:false},
  assortment:{categories:{mode:'all'},merchants:{mode:'all'},registry:{categories:[],merchants:[]}},
  discovery:{currency:'USD',budgets:[100,250,500],resultLimit:5,prompts:['Help me find something distinctive','Find complementary pieces for my style','Help me refine my choices']},
  agent:{personality:'A thoughtful personal shopping companion',tone:'Warm, personable and concise',guidance:'Ask at most one useful question at a time.',greeting:'What are you looking for today?',model:'gpt-6.1-sol',imageModel:'gpt-image-2.6-flare',photoWorkflows:['complementary','similar']},
  app:{slug:'premium-agent',scheme:'shoppingagent',iosBundleId:'com.example.shoppingagent',androidPackage:'com.example.shoppingagent',version:'0.1.0',iosBuild:'1',androidVersionCode:1},
  copy:{}
};
