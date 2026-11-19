-- Email preferences are server-managed, separate from optional analytics.
create table public.customer_email_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 welcome_enabled boolean not null default false,
 weekly_enabled boolean not null default false,
 suppressed boolean not null default false,
 consent_version text,
 consent_at timestamptz,
 updated_at timestamptz not null default now(),
 next_weekly_at timestamptz not null default now() + interval '7 days',
 next_marketing_at timestamptz not null default '-infinity',
 sent_product_ids text[] not null default '{}'
);
create table public.customer_email_jobs (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check (kind in ('welcome','edit','weekly')),
 dedupe_key text not null unique,
 payload jsonb not null default '{}' check(octet_length(payload::text) <= 40000),
 status text not null default 'pending' check(status in ('pending','processing','sent','failed','unknown','skipped')),
 scheduled_at timestamptz not null default now(),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 provider_id text,
 error_code text
);
create index customer_email_jobs_due on public.customer_email_jobs(scheduled_at) where status='pending';
create index customer_email_jobs_user on public.customer_email_jobs(user_id,created_at desc);
create table public.customer_email_events (
 id text primary key,
 job_id uuid references public.customer_email_jobs(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 event text not null,
 created_at timestamptz not null default now()
);
create table public.customer_email_consents (
 id bigint generated always as identity primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 welcome_enabled boolean not null,
 weekly_enabled boolean not null,
 source text not null,
 version text not null,
 created_at timestamptz not null default now()
);
alter table public.customer_email_preferences enable row level security;
alter table public.customer_email_jobs enable row level security;
alter table public.customer_email_events enable row level security;
alter table public.customer_email_consents enable row level security;
revoke all on public.customer_email_preferences, public.customer_email_jobs, public.customer_email_events, public.customer_email_consents from anon, authenticated;
grant all on public.customer_email_preferences, public.customer_email_jobs, public.customer_email_events, public.customer_email_consents to service_role;
grant usage, select on sequence public.customer_email_consents_id_seq to service_role;

create function public.set_customer_email_preferences(p_user uuid, p_welcome boolean, p_weekly boolean, p_source text)
returns void language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text, 851));
 if not exists(select 1 from auth.users where id=p_user and email_confirmed_at is not null and not coalesce(is_anonymous,false)) then raise exception 'Verified account required'; end if;
 insert into public.customer_email_preferences(user_id,welcome_enabled,weekly_enabled,consent_version,consent_at)
 values(p_user,p_welcome,p_weekly,'2026-11-09',now())
 on conflict(user_id) do update set welcome_enabled=p_welcome,weekly_enabled=p_weekly,consent_version='2026-11-09',consent_at=now(),updated_at=now();
 insert into public.customer_email_consents(user_id,welcome_enabled,weekly_enabled,source,version)
 values(p_user,p_welcome,p_weekly,left(p_source,40),'2026-11-09');
 if p_welcome then
  insert into public.customer_email_jobs(user_id,kind,dedupe_key) values(p_user,'welcome','welcome:'||p_user::text) on conflict(dedupe_key) do nothing;
 end if;
end $$;

create function public.enqueue_customer_email_edit(p_user uuid,p_ids text[],p_key text)
returns uuid language plpgsql security definer set search_path='' as $$
declare job uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,851));
 select id into job from public.customer_email_jobs where dedupe_key='edit:'||p_user::text||':'||p_key;
 if job is not null then return job; end if;
 if array_length(p_ids,1) not between 1 and 5 then raise exception 'Invalid selection'; end if;
 if (select count(*) from public.customer_email_jobs where user_id=p_user and kind='edit' and created_at>now()-interval '1 day')>=3 then raise exception 'EMAIL_DAILY_LIMIT'; end if;
 insert into public.customer_email_jobs(user_id,kind,dedupe_key,payload)
 values(p_user,'edit','edit:'||p_user::text||':'||p_key,jsonb_build_object('productIds',to_jsonb(p_ids))) returning id into job;
 return job;
end $$;

create function public.enqueue_weekly_customer_emails()
returns integer language plpgsql security definer set search_path='' as $$
declare pref record; total integer:=0;
begin
 for pref in select * from public.customer_email_preferences where weekly_enabled and not suppressed and next_weekly_at<=now() order by next_weekly_at limit 50 for update skip locked loop
  insert into public.customer_email_jobs(user_id,kind,dedupe_key,scheduled_at)
  values(pref.user_id,'weekly','weekly:'||pref.user_id::text||':'||pref.next_weekly_at::text,greatest(now(),pref.next_marketing_at)) on conflict(dedupe_key) do nothing;
  update public.customer_email_preferences set next_weekly_at=now()+interval '7 days' where user_id=pref.user_id;
  total:=total+1;
 end loop;
 return total;
end $$;

create function public.claim_customer_email(p_job uuid)
returns setof public.customer_email_jobs language plpgsql security definer set search_path='' as $$
declare job public.customer_email_jobs; pref public.customer_email_preferences;
begin
 select * into job from public.customer_email_jobs where id=p_job and status='pending' and scheduled_at<=now() for update skip locked;
 if job.id is null then return; end if;
 perform pg_advisory_xact_lock(hashtextextended(job.user_id::text,851));
 select * into pref from public.customer_email_preferences where user_id=job.user_id for update;
 if pref.suppressed or (job.kind='welcome' and not coalesce(pref.welcome_enabled,false)) or (job.kind='weekly' and not coalesce(pref.weekly_enabled,false)) then
  update public.customer_email_jobs set status='skipped',updated_at=now() where id=job.id; return;
 end if;
 if job.kind<>'edit' then
  if pref.next_marketing_at>now() then
   update public.customer_email_jobs set scheduled_at=pref.next_marketing_at where id=job.id; return;
  end if;
  update public.customer_email_preferences set next_marketing_at=now()+interval '7 days' where user_id=job.user_id;
 end if;
 return query update public.customer_email_jobs set status='processing',updated_at=now() where id=job.id returning *;
end $$;

revoke all on function public.set_customer_email_preferences(uuid,boolean,boolean,text), public.enqueue_customer_email_edit(uuid,text[],text), public.enqueue_weekly_customer_emails(), public.claim_customer_email(uuid) from public,anon,authenticated;
grant execute on function public.set_customer_email_preferences(uuid,boolean,boolean,text), public.enqueue_customer_email_edit(uuid,text[],text), public.enqueue_weekly_customer_emails(), public.claim_customer_email(uuid) to service_role;

create table public.customer_email_webhook_nonces (hash text primary key, created_at timestamptz not null default now());
alter table public.customer_email_webhook_nonces enable row level security;
revoke all on public.customer_email_webhook_nonces from anon,authenticated;
grant all on public.customer_email_webhook_nonces to service_role;
create function public.record_customer_email_webhook(p_nonce text,p_event_id text,p_job uuid,p_event text,p_permanent boolean)
returns void language plpgsql security definer set search_path='' as $$
declare inserted text; owner_id uuid;
begin
 insert into public.customer_email_webhook_nonces(hash) values(p_nonce) on conflict do nothing returning hash into inserted;
 if inserted is null then return; end if;
 select user_id into owner_id from public.customer_email_jobs where id=p_job;
 if owner_id is null then return; end if;
 insert into public.customer_email_events(id,job_id,user_id,event) values(p_event_id,p_job,owner_id,p_event) on conflict do nothing;
 if p_event in ('complained','unsubscribed') or (p_event='failed' and p_permanent) then
  update public.customer_email_preferences set suppressed=true,welcome_enabled=false,weekly_enabled=false,updated_at=now() where user_id=owner_id;
 end if;
 if p_event in ('accepted','delivered') then
  update public.customer_email_jobs set status='sent',error_code=null,updated_at=now() where id=p_job and status in ('processing','unknown');
 end if;
end $$;
revoke all on function public.record_customer_email_webhook(text,text,uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.record_customer_email_webhook(text,text,uuid,text,boolean) to service_role;
