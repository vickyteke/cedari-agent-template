import {t} from "../../../../../packages/config/src/copy";
import { agentConfig, type FeatureId } from '../../../../../packages/config/src/public';
import { CommerceError } from '../mcp/commerce';
export function requireFeature(feature:FeatureId, features:Partial<Record<FeatureId,boolean>>=agentConfig.features):void {
 if(!features[feature]) throw new CommerceError(t("backend.3e747eb226"),403,'feature_disabled');
}
export function availableTools<T extends {name:string}>(tools:T[], features:Partial<Record<FeatureId,boolean>>=agentConfig.features):T[] {
 return tools.filter(t=>(t.name!=='create_cart_link'||features.checkout)&&(t.name!=='compare_products'||features.comparison));
}
export function assertRequestCapabilities(input:{messages:{images?:unknown[];previewContext?:string}[]}) {
 if(input.messages.some(m=>m.images?.length)) requireFeature('uploads');
}
