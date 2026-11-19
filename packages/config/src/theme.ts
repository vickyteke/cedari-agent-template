import { agentConfig } from '../../../config/agent.ts';
const defaults:Record<string,string>={'#f7f2eb':'paper','#27221f':'ink','#8a624a':'accent','#7b7168':'muted','#dfd6ca':'line','#fffcf8':'white','#ebe3d8':'soft','#53634c':'green','#9e3d30':'error','#193e3a':'teal'};
export function styleToken<T extends string|number>(key:string,property:string,fallback:T):T {
 const theme=agentConfig.theme;
 const override=theme.overrides?.[key];
 if(override!==undefined)return override as T;
 if(typeof fallback==='string') return (defaults[fallback]?theme.colors[defaults[fallback]]:fallback) as T;
 if(['fontSize','lineHeight','letterSpacing'].includes(property))return (Number(fallback)*theme.typeScale) as T;
 if(property.toLowerCase().includes('radius'))return (Number(fallback)*theme.radiusScale) as T;
 if(/^(padding|margin|gap|rowGap|columnGap)/.test(property))return (Number(fallback)*theme.spacingScale) as T;
 if(property==='shadowOpacity')return theme.shadowOpacity as T;
 return fallback;
}
