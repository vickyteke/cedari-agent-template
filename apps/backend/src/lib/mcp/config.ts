import {t} from "../../../../../packages/config/src/copy";
export function usesCedari() { return true; }
export function mcpConnection() {
 const endpoint=process.env.CEDARI_MCP_URL, credential=process.env.CEDARI_API_KEY;
 if(!endpoint) throw Error(t("backend.4c9f07bb27"));
 return {endpoint,credential};
}
