import type { AgentConfig, PreferenceField } from './schema.ts';
export type PreferenceAnswers = Record<string,string|string[]>;
export type ProfilePreferences = {name:string;preferences:string;answers:PreferenceAnswers};
export function migratePreferences(raw:unknown,_config:AgentConfig):ProfilePreferences {
 const p=(raw&&typeof raw==='object'?raw:{}) as Partial<ProfilePreferences>;
 const answers:PreferenceAnswers={};
 for(const [key,value] of Object.entries(p.answers||{})) {
  if(typeof value==='string') answers[key]=value.slice(0,1200);
  else if(Array.isArray(value)&&value.every(v=>typeof v==='string')) answers[key]=value.slice(0,30).map(v=>v.slice(0,120));
 }
 return {name:typeof p.name==='string'?p.name.slice(0,80):'',preferences:typeof p.preferences==='string'?p.preferences.slice(0,1200):'',answers};
}
export function validateAnswers(answers:PreferenceAnswers,fields:PreferenceField[]):{valid:boolean;errors:string[]} {
 const errors:string[]=[];
 for(const f of fields) {
  const value=answers[f.id],values=Array.isArray(value)?value:typeof value==='string'&&value.trim()?[value]:[];
  if(f.required&&!values.length) errors.push(f.label);
  if(f.type!=='text'&&values.some(v=>!f.options?.some(o=>o.id===v))) errors.push(f.label);
  if(f.type==='text'&&(typeof value==='object'||(typeof value==='string'&&value.length>(f.maxLength||900)))) errors.push(f.label);
 }
 return {valid:errors.length===0,errors:[...new Set(errors)]};
}
export function preferenceContext(profile:ProfilePreferences,config:AgentConfig):string {
 return [profile.preferences,...config.onboarding.fields.filter(f=>f.id!=='name'&&f.id!=='preferences').flatMap(f=>{
  const value=profile.answers[f.id]; if(!value)return [];
  const values=Array.isArray(value)?value:[value];
  return [f.label+': '+values.map(v=>f.options?.find(o=>o.id===v)?.label||v).join(', ')];
 })].join('\n').slice(0,1200);
}
