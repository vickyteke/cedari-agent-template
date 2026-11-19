import {t} from "../../../../../packages/config/src/copy";
import { agentConfig, type Selection } from '../../../../../packages/config/src/public';
import { CommerceError } from '../mcp/commerce';
export type CatalogMetadata = { categories:{id:string;label:string}[]; merchants:{id:string;label:string}[] };
export type AssortmentPolicy = { categories:Selection; merchants:Selection };
export type ResolvedAssortment = AssortmentPolicy;
export type CatalogProduct = { category:string; merchantId:string };
export type SearchFilters = { category?:string; store?:string };
export function resolveAssortment(policy:AssortmentPolicy, metadata:CatalogMetadata):ResolvedAssortment {
 for(const key of ['categories','merchants'] as const) {
  const s=policy[key];
  if(s.mode==='allowlist' && (!s.ids.length || s.ids.some(id=>!metadata[key].some(v=>v.id===id)))) throw Error('Invalid '+key+' allowlist');
 }
 return policy;
}
export function configuredAssortment():ResolvedAssortment { return resolveAssortment(agentConfig.assortment,agentConfig.assortment.registry); }
function selected(s:Selection,id:string) { return s.mode==='all'||s.ids.includes(id); }
export function allowsProduct(policy:ResolvedAssortment, product:CatalogProduct) {
 return selected(policy.categories,product.category)&&selected(policy.merchants,product.merchantId);
}
export function intersectSearch(policy:ResolvedAssortment,filters:SearchFilters) {
 if((filters.category&&!selected(policy.categories,filters.category))||(filters.store&&!selected(policy.merchants,filters.store))) throw new CommerceError(t("backend.3c7b78469c"),403,'feature_disabled');
 return {
  ...(policy.categories.mode==='allowlist'?{categories:policy.categories.ids}:{}),
  ...(filters.category?{category:filters.category}:{}),
  ...(filters.store?{merchant_ids:[filters.store]}:policy.merchants.mode==='allowlist'?{merchant_ids:policy.merchants.ids}:{})
 };
}
