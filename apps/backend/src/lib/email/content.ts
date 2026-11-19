import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Product } from '../types';
export const emailOrigin = 'https://www.arviva.space';
export const consentVersion = '2026-11-09';
export function html(value: string) { return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!); }
export function safeUrl(value: string | null | undefined) {
 try { const url=new URL(value || ''); return url.href.length<=2048 && url.protocol==='https:' && !url.username && !url.password && !url.port && /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(url.hostname) && !/^\d+(\.\d+){3}$/.test(url.hostname) && !url.hostname.endsWith('.local') && !url.hostname.endsWith('.localhost') ? url.href : null; } catch { return null; }
}
function secret() { const key=process.env.EMAIL_TOKEN_SECRET; if(!key || key.length<32) throw Error('Email signing is not configured'); return key; }
export function tokenFor(purpose: 'unsubscribe'|'edit', id: string) { return createHmac('sha256',secret()).update(`${purpose}:${id}`).digest('hex'); }
export function validToken(purpose: 'unsubscribe'|'edit',id: string,token: string) {
 if(!/^[0-9a-f-]{36}$/i.test(id) || !/^[0-9a-f]{64}$/.test(token)) return false;
 const expected=tokenFor(purpose,id); return timingSafeEqual(Buffer.from(expected),Buffer.from(token));
}
export function unsubscribeUrl(userId: string) { return `${emailOrigin}/email/unsubscribe?user=${userId}&token=${tokenFor('unsubscribe',userId)}`; }
export function editUrl(jobId: string) { return `${emailOrigin}/email/open?edit=${jobId}&token=${tokenFor('edit',jobId)}`; }
export function layout(title: string,body: string,footer: string) {
 return `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><meta charset="utf-8"><title>${html(title)}</title></head><body style="margin:0;background:#f7f2eb;color:#193e3a;font-family:Arial,sans-serif"><main style="max-width:560px;margin:auto;padding:32px 24px"><p style="font-family:Georgia,serif;font-size:25px">arviva space</p><h1 style="font-family:Georgia,serif;font-size:30px;line-height:1.25">${html(title)}</h1>${body}<footer style="font-size:12px;line-height:1.7;color:#746c63;margin-top:30px">${footer}</footer></main></body></html>`;
}
export function productCards(products: Product[],jobId: string) {
 return products.slice(0,5).map(p=>{ const image=safeUrl(p.image_url); const label=new Intl.NumberFormat('en-US',{style:'currency',currency:p.currency}).format(p.price); return `<article style="padding:18px;background:#fffcf8;border-radius:18px;margin:16px 0">${image?`<img src="${html(image)}" width="240" alt="${html(p.title)}" style="max-width:100%;height:auto;border-radius:12px">`:''}<h2 style="font-family:Georgia,serif;font-size:22px">${html(p.title)}</h2><p>${html(p.merchant_name||p.vendor||p.store_key)}${p.variant_title?` · ${html(p.variant_title)}`:''}</p><p>${html(label)}</p><a style="color:#193e3a" href="${html(editUrl(jobId))}#${html(encodeURIComponent(p.id))}">Explore this piece</a></article>`; }).join('');
}
export function messageContent(kind: string,name: string,products: Product[],jobId: string,userId: string) {
 const subject=kind==='welcome'?'Welcome to your Arviva Space':kind==='weekly'?'A few pieces for the home you’re imagining':'Your personal edit is ready';
 const greeting=name?`Hello ${html(name.slice(0,80))},`:'Make yourself at home.';
 const intro=kind==='welcome'?'Your home has a point of view. Arviva is here to help you bring it to life. Describe the space you’re imagining, share a room photo in the app, or save pieces you love. Your conversations and favorites can follow you across devices.':kind==='weekly'?'A small selection inspired by the preferences and pieces you’ve shared with Arviva.':'Here are the pieces you asked Arviva to send. Take your time with them, and return whenever you’re ready.';
 const postal=process.env.EMAIL_POSTAL_ADDRESS?.trim(); if(!postal) throw Error('Business mailing address is not configured');
 const footer=`Arviva Space · Cedari AI<br>${html(postal)}<br><a href="${html(unsubscribeUrl(userId))}">Unsubscribe from welcome and personal-edit emails</a> · <a href="${emailOrigin}/privacy">Privacy</a>`;
 const body=`<p>${greeting}</p><p style="line-height:1.8">${intro}</p>${productCards(products,jobId)}<p><a href="${html(editUrl(jobId))}" style="display:inline-block;border-radius:30px;background:#193e3a;color:#fffaf0;padding:14px 24px;text-decoration:none">${kind==='welcome'?'Meet your home companion':'Open your personal edit'}</a></p>${products.length?'<p style="font-size:12px;color:#746c63">Prices and availability may change. Confirm your exact variant, delivery and returns with the merchant before purchasing.</p>':''}`;
 const text=`${name?`Hello ${name.slice(0,80)},`:'Make yourself at home.'}\n\n${intro}\n\n${products.map(p=>`${p.title}${p.variant_title?` — ${p.variant_title}`:''}\n${p.currency} ${p.price}\n`).join('\n')}\nOpen Arviva: ${editUrl(jobId)}\n\nArviva Space · Cedari AI\n${postal}\nUnsubscribe: ${unsubscribeUrl(userId)}`;
 return {subject,html:layout(subject,body,footer),text};
}
export function validWebhookSignature(timestamp: string,token: string,signature: string,now=Date.now()) {
 const key=process.env.MAILGUN_WEBHOOK_SIGNING_KEY;
 if(!key || !/^\d{10}$/.test(timestamp) || !/^[a-z0-9]{16,128}$/i.test(token) || !/^[a-f0-9]{64}$/i.test(signature) || Math.abs(now/1000-Number(timestamp))>300) return false;
 const expected=createHmac('sha256',key).update(timestamp+token).digest('hex'); return timingSafeEqual(Buffer.from(expected),Buffer.from(signature.toLowerCase()));
}
