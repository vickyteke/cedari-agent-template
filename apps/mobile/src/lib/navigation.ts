import {
  agentConfig,
  availableTabs,
  type TabId,
  type AgentConfig,
} from "../../../../packages/config/src/public.ts";
export const tabRoute = (id: TabId) => id;
export const tabHref = (id: TabId) => "/" + id;
export const tabs = availableTabs(agentConfig);
export function routeAvailable(
  path: string,
  config: AgentConfig = agentConfig,
): boolean {
  const leaf = path.replace(/^\//, "") || "";
  const tab = availableTabs(config).find((t) => tabRoute(t.id) === leaf);
  if (["chat", "discover", "saved", "bag", "profile"].includes(leaf))
    return !!tab;
  return leaf !== "compare" || config.features.comparison;
}
export const initialHref = tabHref(agentConfig.navigation.initialTab);
