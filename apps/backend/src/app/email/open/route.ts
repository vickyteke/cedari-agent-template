import { html,layout,safeUrl,validToken } from '@/lib/email/content';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getPublicEdit } from '@/lib/email/service';
export async function GET(request:Request) {
 try {
  const url=new URL(request.url),id=url.searchParams.get('edit')||'',token=url.searchParams.get('token')||'';
  if(!validToken('edit',id,token))return new Response('This edit link is invalid.',{status:400});
  const job=await getPublicEdit(id);if(!job)return new Response('This edit is no longer available.',{status:404});
  const {error:eventError}=await getSupabaseAdmin().from('customer_email_events').upsert({id:`edit-link:${job.id}:${new Date().toISOString().slice(0,10)}`,job_id:job.id,user_id:job.user_id,event:'edit_link_viewed'},{onConflict:'id',ignoreDuplicates:true});
  // Link scanners can also visit; report this as a link-page view, not an email open.
  if(eventError) console.error('Email link metric unavailable');
  const pieces=(job.payload.products||[]).slice(0,5);
  const content=`<p>A few pieces to consider, at your own pace.</p>${pieces.map(p=>{const image=safeUrl(p.image_url),merchant=safeUrl(p.product_url);return `<article id="${html(encodeURIComponent(p.id))}" style="background:#fffcf8;border-radius:20px;padding:20px;margin:18px 0">${image?`<img alt="${html(p.title)}" src="${html(image)}" style="max-width:100%;max-height:320px;border-radius:16px">`:''}<h2>${html(p.title)}</h2><p>${html(p.merchant_name||p.vendor||p.store_key)}${p.variant_title?` · ${html(p.variant_title)}`:''}</p><p>${html(new Intl.NumberFormat('en-US',{style:'currency',currency:p.currency}).format(p.price))}</p><p><a href="arviva:///product/${encodeURIComponent(p.id)}">Open in Arviva</a></p>${merchant?`<p><a rel="noreferrer" href="${html(merchant)}">View at the merchant’s website</a></p>`:''}</article>`;}).join('')}<p><a href="arviva:///">Continue with Arviva</a></p><p style="font-size:12px">Prices and availability may change. Confirm your exact variant and purchase details with the merchant.</p>`;
  return new Response(layout('Your personal edit',content,'Arviva Space · Cedari AI'),{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow','Content-Security-Policy':"default-src 'none'; img-src https:; style-src 'unsafe-inline'; frame-ancestors 'none'"}});
 }catch{return new Response('Your edit could not be loaded. Please try again later.',{status:503});}
}
