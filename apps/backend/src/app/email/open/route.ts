import {t} from "../../../../../../packages/config/src/copy";
import { agentConfig } from "../../../../../../packages/config/src/public";
import { html,layout,safeUrl,validToken } from '@/lib/email/content';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getPublicEdit } from '@/lib/email/service';
export async function GET(request:Request) {
 try {
  const url=new URL(request.url),id=url.searchParams.get('edit')||'',token=url.searchParams.get('token')||'';
  if(!validToken('edit',id,token))return new Response(t("backend.9e44b46c17"),{status:400});
  const job=await getPublicEdit(id);if(!job)return new Response(t("backend.b6e2ac9c00"),{status:404});
  const {error:eventError}=await getSupabaseAdmin().from('customer_email_events').upsert({id:`edit-link:${job.id}:${new Date().toISOString().slice(0,10)}`,job_id:job.id,user_id:job.user_id,event:'edit_link_viewed'},{onConflict:'id',ignoreDuplicates:true});
  // Link scanners can also visit; report this as a link-page view, not an email open.
  if(eventError) console.error(t("backend.d04ef3e140"));
  const pieces=(job.payload.products||[]).slice(0,5);
  const content=`<p>A few pieces to consider, at your own pace.</p>${pieces.map(p=>{const image=safeUrl(p.image_url),merchant=safeUrl(p.product_url);return `<article id="${html(encodeURIComponent(p.id))}" style="background:#fffcf8;border-radius:20px;padding:20px;margin:18px 0">${image?`<img alt="${html(p.title)}" src="${html(image)}" style="max-width:100%;max-height:320px;border-radius:16px">`:''}<h2>${html(p.title)}</h2><p>${html(p.merchant_name||p.vendor||p.store_key)}${p.variant_title?` · ${html(p.variant_title)}`:''}</p><p>${html(new Intl.NumberFormat('en-US',{style:'currency',currency:p.currency}).format(p.price))}</p><p><a href="${agentConfig.app.scheme}:///product/${encodeURIComponent(p.id)}">Open in ${html(agentConfig.brand.name)}</a></p>${merchant?`<p><a rel="noreferrer" href="${html(merchant)}">View at the merchant’s website</a></p>`:''}</article>`;}).join('')}<p><a href="${agentConfig.app.scheme}:///">Continue with ${html(agentConfig.brand.name)}</a></p><p style="font-size:12px">Prices and availability may change. Confirm your exact variant and purchase details with the merchant.</p>`;
  return new Response(layout(t("backend.f5fede95f9"),content,agentConfig.brand.name),{headers:{'Content-Type':t("backend.5e30ae1558"),'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':t("backend.137a9fc1fe"),'Content-Security-Policy':t("backend.555c8478b2")}});
 }catch{return new Response(t("backend.d56935a138"),{status:503});}
}
