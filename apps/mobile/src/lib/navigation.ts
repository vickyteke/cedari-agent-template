import { agentConfig, availableTabs, type TabId, type AgentConfig } from '../../../../packages/config/src/public.ts';
export const tabRoute = (id:TabId) => id === 'chat' ? 'index' : id;
export const tabHref = (id:TabId) => id === 'chat' ? '/' : '/'+id;
export const tabs = availableTabs(agentConfig);
export function routeAvailable(path:string,config:AgentConfig=agentConfig):boolean {
 const leaf=path.replace(/^\//,'')||'index';
 const tab=availableTabs(config).find(t=>tabRoute(t.id)===leaf);
 if(['index','discover','saved','bag','profile'].includes(leaf)) return !!tab;
 return leaf!=='compare'||config.features.comparison;
}
export const initialHref=tabHref(agentConfig.navigation.initialTab);
