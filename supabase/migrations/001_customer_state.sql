-- Standalone customer state migration. No catalog or merchant credentials are exposed.
create table public.shopper_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  version bigint not null default 1,
  state jsonb not null default '{}'::jsonb check (octet_length(state::text) <= 2000000),
  updated_at timestamptz not null default now()
);
alter table public.shopper_state enable row level security;
create policy "Customers read their own state" on public.shopper_state for select to authenticated using ((select auth.uid()) = user_id);
-- Writes go through an optimistic concurrency RPC, preventing silent overwrite.
create or replace function public.save_shopper_state(payload jsonb, expected_version bigint)
returns bigint language plpgsql security definer set search_path = '' as $$
declare next_version bigint;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if expected_version = 0 then
    insert into public.shopper_state(user_id, state) values(auth.uid(), payload)
      on conflict do nothing returning version into next_version;
  else
    update public.shopper_state set state = payload, version = version + 1, updated_at = now()
      where user_id = auth.uid() and version = expected_version returning version into next_version;
  end if;
  if next_version is null then raise exception 'STATE_CONFLICT'; end if;
  return next_version;
end $$;
revoke all on function public.save_shopper_state(jsonb, bigint) from public, anon;
grant execute on function public.save_shopper_state(jsonb, bigint) to authenticated;
grant select on public.shopper_state to authenticated;

create table public.mobile_rate_buckets (key text primary key, window_start timestamptz not null, requests int not null);
alter table public.mobile_rate_buckets enable row level security;
create or replace function public.mobile_rate_limit(bucket_key text, max_requests int)
returns boolean language plpgsql security definer set search_path = '' as $$
declare count_now int;
begin
  insert into public.mobile_rate_buckets as b(key, window_start, requests)
  values(bucket_key, date_trunc('minute', now()), 1)
  on conflict(key) do update set
    requests = case when b.window_start = excluded.window_start then b.requests + 1 else 1 end,
    window_start = excluded.window_start returning requests into count_now;
  if random() < 0.01 then delete from public.mobile_rate_buckets where window_start < now() - interval '1 day'; end if;
  return count_now <= max_requests;
end $$;
revoke all on function public.mobile_rate_limit(text, int) from public, anon, authenticated;
grant execute on function public.mobile_rate_limit(text, int) to service_role;
