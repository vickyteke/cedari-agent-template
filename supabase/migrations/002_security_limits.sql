-- Admission counters are private and atomic across all application instances.
create index if not exists mobile_rate_buckets_expiry on public.mobile_rate_buckets(window_start);
create table public.security_budgets (
  key text primary key,
  window_start timestamptz not null,
  requests integer not null
);
alter table public.security_budgets enable row level security;
create index security_budgets_expiry on public.security_budgets(window_start);
create or replace function public.security_budget(bucket_key text, max_requests integer, window_seconds integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare admitted integer; starts timestamptz;
begin
  if max_requests < 1 or window_seconds < 1 then return false; end if;
  starts := to_timestamp(floor(extract(epoch from now()) / window_seconds) * window_seconds);
  insert into public.security_budgets as b values (bucket_key, starts, 1)
  on conflict(key) do update set
    requests = case when b.window_start = excluded.window_start then b.requests + 1 else 1 end,
    window_start = excluded.window_start
    where b.window_start <> excluded.window_start or b.requests < max_requests
  returning requests into admitted;
  return admitted is not null;
end $$;
revoke all on function public.security_budget(text, integer, integer) from public, anon, authenticated;
grant execute on function public.security_budget(text, integer, integer) to service_role;
-- Never perform an unbounded garbage collection scan inside admission.
create or replace function public.mobile_rate_limit(bucket_key text, max_requests integer)
returns boolean language sql security definer set search_path = '' as $$
  select public.security_budget(bucket_key, max_requests, 60);
$$;


create table public.security_leases (id uuid primary key default gen_random_uuid(), pool text not null, owner text not null, expires_at timestamptz not null);
alter table public.security_leases enable row level security;
create index security_leases_pool_expiry on public.security_leases(pool, expires_at);
create or replace function public.acquire_security_lease(pool_name text, owner_key text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare result uuid; pool_limit integer; owner_limit integer;
begin
  if pool_name not in ('customer', 'agent', 'public') then return null; end if;
  perform pg_advisory_xact_lock(hashtextextended('arviva:lease:' || pool_name, 0));
  delete from public.security_leases where pool = pool_name and expires_at <= now();
  pool_limit := case when pool_name = 'customer' then 8 else 4 end;
  owner_limit := case when pool_name = 'customer' then 8 else 2 end;
  if (select count(*) from public.security_leases where pool = pool_name) >= pool_limit
    or (select count(*) from public.security_leases where pool = pool_name and owner = owner_key) >= owner_limit then return null; end if;
  insert into public.security_leases(pool, owner, expires_at) values(pool_name, owner_key, now() + interval '30 seconds') returning id into result;
  return result;
end $$;
create or replace function public.release_security_lease(lease_id uuid)
returns void language sql security definer set search_path = '' as $$
  delete from public.security_leases where id = lease_id;
$$;
revoke all on function public.acquire_security_lease(text,text), public.release_security_lease(uuid) from public, anon, authenticated;
grant execute on function public.acquire_security_lease(text,text), public.release_security_lease(uuid) to service_role;


-- Reserve a conservative token upper bound BEFORE calling the model. No refunds
-- on errors/cancellation: retries and parallel instances cannot exceed the cap.
create or replace function public.reserve_model_tokens(pool_name text, reserved_tokens integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare admitted integer; ceiling integer; starts timestamptz;
begin
  if pool_name not in ('guest', 'customer') or reserved_tokens < 1 or reserved_tokens > 300000 then return false; end if;
  ceiling := case when pool_name = 'guest' then 500000 else 1500000 end;
  starts := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
  insert into public.security_budgets as b values ('model-tokens:' || pool_name, starts, reserved_tokens)
  on conflict(key) do update set
    requests = case when b.window_start = excluded.window_start then b.requests + excluded.requests else excluded.requests end,
    window_start = excluded.window_start
    where b.window_start <> excluded.window_start or b.requests + excluded.requests <= ceiling
  returning requests into admitted;
  return admitted is not null;
end $$;
revoke all on function public.reserve_model_tokens(text, integer) from public, anon, authenticated;
grant execute on function public.reserve_model_tokens(text, integer) to service_role;


-- Allow a normal 24-card image grid while retaining a global public pool bound.
create or replace function public.acquire_security_lease(pool_name text, owner_key text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare result uuid; pool_limit integer; owner_limit integer;
begin
  if pool_name not in ('customer', 'agent', 'public') then return null; end if;
  perform pg_advisory_xact_lock(hashtextextended('arviva:lease:' || pool_name, 0));
  delete from public.security_leases where pool = pool_name and expires_at <= now();
  pool_limit := case when pool_name = 'customer' then 8 when pool_name = 'public' then 32 else 4 end;
  owner_limit := case when pool_name = 'customer' then 8 when pool_name = 'public' then 32 else 2 end;
  if (select count(*) from public.security_leases where pool = pool_name) >= pool_limit
    or (select count(*) from public.security_leases where pool = pool_name and owner = owner_key) >= owner_limit then return null; end if;
  insert into public.security_leases(pool, owner, expires_at) values(pool_name, owner_key, now() + interval '30 seconds') returning id into result;
  return result;
end $$;


-- Operator-editable limits. No customer/anonymous access, including read access.
create table public.chat_limit_settings (
  pool text primary key check (pool in ('guest', 'customer')),
  enabled boolean not null default true,
  requests_per_user_minute integer not null check (requests_per_user_minute between 0 and 1000),
  requests_per_user_day integer not null check (requests_per_user_day between 0 and 100000),
  requests_per_ip_day integer not null check (requests_per_ip_day between 0 and 100000),
  requests_per_pool_day integer not null check (requests_per_pool_day between 0 and 1000000),
  requests_per_pool_minute integer not null check (requests_per_pool_minute between 0 and 10000),
  model_tokens_per_day integer not null check (model_tokens_per_day between 0 and 100000000),
  updated_at timestamptz not null default now()
);
alter table public.chat_limit_settings enable row level security;
revoke all on public.chat_limit_settings from public, anon, authenticated;
grant select, update on public.chat_limit_settings to service_role;
insert into public.chat_limit_settings values
 ('guest', true, 12, 15, 30, 100, 4, 500000, now()),
 ('customer', true, 12, 100, 150, 400, 12, 1500000, now());

create table public.chat_limit_settings_audit (
 id bigint generated always as identity primary key,
 changed_at timestamptz not null default now(),
 changed_by text not null,
 database_role text not null,
 old_settings jsonb,
 new_settings jsonb
);
alter table public.chat_limit_settings_audit enable row level security;
revoke all on public.chat_limit_settings_audit from public, anon, authenticated, service_role;
grant select on public.chat_limit_settings_audit to service_role;
create function public.audit_chat_limit_settings()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if tg_op = 'UPDATE' then new.updated_at := now(); end if;
 insert into public.chat_limit_settings_audit(changed_by,database_role,old_settings,new_settings)
 values(coalesce(auth.uid()::text,session_user::text),coalesce(auth.role(),session_user::text),
 case when tg_op <> 'INSERT' then to_jsonb(old) end,case when tg_op <> 'DELETE' then to_jsonb(new) end);
 if tg_op = 'DELETE' then return old; end if;
 return new;
end $$;
revoke all on function public.audit_chat_limit_settings() from public, anon, authenticated, service_role;
create trigger chat_limit_settings_audit_trigger before insert or update or delete on public.chat_limit_settings
for each row execute function public.audit_chat_limit_settings();

-- One server-only call; the limits are read on every admission (no stale cache).
create function public.admit_chat_with_limits(pool_name text, bucket_keys text[])
returns boolean language plpgsql security definer set search_path = '' as $$
declare settings public.chat_limit_settings%rowtype; limits integer[]; windows integer[] := array[86400,86400,86400,60,60]; i integer;
begin
 if pool_name not in ('guest','customer') or coalesce(array_length(bucket_keys,1),0) <> 5 then return false; end if;
 if exists(select 1 from unnest(bucket_keys) as k where k is null or k !~ '^[a-f0-9]{64}$') then return false; end if;
 select * into settings from public.chat_limit_settings where pool=pool_name;
 if not found or not settings.enabled then return false; end if;
 limits := array[settings.requests_per_ip_day,settings.requests_per_user_day,settings.requests_per_pool_day,settings.requests_per_pool_minute,settings.requests_per_user_minute];
 for i in 1..5 loop
  if not public.security_budget(bucket_keys[i],limits[i],windows[i]) then return false; end if;
 end loop;
 return true;
end $$;
revoke all on function public.admit_chat_with_limits(text,text[]) from public, anon, authenticated;
grant execute on function public.admit_chat_with_limits(text,text[]) to service_role;

create function public.reserve_model_tokens(pool_name text, reserved_tokens integer, token_ceiling integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare admitted integer; ceiling integer; starts timestamptz;
begin
 if pool_name not in ('guest','customer') or reserved_tokens is null or reserved_tokens < 1 or reserved_tokens > 300000 or token_ceiling is null or token_ceiling < 1 then return false; end if;
 select least(model_tokens_per_day,token_ceiling,100000000) into ceiling
 from public.chat_limit_settings where pool=pool_name and enabled;
 if ceiling is null or reserved_tokens > ceiling then return false; end if;
 starts := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
 insert into public.security_budgets as b values ('model-tokens:' || pool_name, starts, reserved_tokens)
 on conflict(key) do update set
  requests = case when b.window_start = excluded.window_start then b.requests + excluded.requests else excluded.requests end,
  window_start = excluded.window_start
  where b.window_start <> excluded.window_start or b.requests + excluded.requests <= ceiling
 returning requests into admitted;
 return admitted is not null;
end $$;
revoke all on function public.reserve_model_tokens(text,integer,integer) from public, anon, authenticated;
grant execute on function public.reserve_model_tokens(text,integer,integer) to service_role;
-- Preserve the old call signature during rolling deployment; new callers pass
-- their operator-controlled environment ceiling explicitly.
create or replace function public.reserve_model_tokens(pool_name text, reserved_tokens integer)
returns boolean language sql security definer set search_path = '' as $$
 select public.reserve_model_tokens(pool_name,reserved_tokens,case when pool_name='guest' then 10000000 else 30000000 end);
$$;
revoke all on function public.reserve_model_tokens(text,integer) from public, anon, authenticated;
grant execute on function public.reserve_model_tokens(text,integer) to service_role;


-- Supabase default grants may include writes for service_role on new tables.
-- Retain only the operations needed by settings readers and trusted editors.
revoke all on public.chat_limit_settings from service_role;
grant select, update on public.chat_limit_settings to service_role;
