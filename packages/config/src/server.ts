export type ServerConfig = { supabaseUrl:string; serviceRoleKey:string; cedariUrl:string; cedariKey:string; apiOrigin:string; allowedOrigins:string[] };
export function loadServerConfig(env: Record<string,string|undefined>): ServerConfig {
  function required(key:string) { const v=env[key]?.trim(); if(!v) throw Error(key+' is required'); return v; }
  function url(key:string) {
    const value=required(key), u=new URL(value);
    if((u.protocol!=='https:' && !(u.protocol==='http:' && ['localhost','127.0.0.1'].includes(u.hostname))) || u.username || u.password) throw Error(key+' must be an HTTPS URL');
    return value.replace(/\/$/,'');
  }
  return {supabaseUrl:url('SUPABASE_URL'),serviceRoleKey:required('SUPABASE_SERVICE_ROLE_KEY'),cedariUrl:url('CEDARI_MCP_URL'),cedariKey:required('CEDARI_API_KEY'),apiOrigin:url('APP_URL'),allowedOrigins:required('ALLOWED_ORIGINS').split(',').map(v=>new URL(v.trim()).origin)};
}
