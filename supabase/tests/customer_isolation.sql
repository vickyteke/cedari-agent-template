begin;
create extension if not exists pgtap with schema extensions;
select plan(12);
select ok((select relrowsecurity from pg_class where oid='public.shopper_state'::regclass),'customer state uses RLS');
select ok(not has_function_privilege('anon','public.security_budget(text,integer,integer)','EXECUTE'),'anonymous cannot invoke service budgets');
select ok(not has_function_privilege('authenticated','public.security_budget(text,integer,integer)','EXECUTE'),'customers cannot invoke service budgets');
select ok(not has_function_privilege('anon','public.reserve_model_tokens(text,integer,integer)','EXECUTE'),'token budgets are private');
select is((select public from storage.buckets where id='agent-chat-images'),false,'images stay private');
select is((select count(*)::integer from public.chat_limit_settings),2,'fresh guest and customer limits exist');

insert into auth.users(id,aud,role,email) values
('11111111-1111-4111-8111-111111111111','authenticated','authenticated','first@example.invalid'),
('22222222-2222-4222-8222-222222222222','authenticated','authenticated','second@example.invalid');
set local role authenticated;
set local request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
select is(public.save_shopper_state('{"profile":{"name":"First"}}'::jsonb,0),1::bigint,'first account can save its own state');
select throws_ok($$select public.save_shopper_state('{"profile":{"name":"Stale"}}'::jsonb,0)$$,'P0001','STATE_CONFLICT','a stale version cannot overwrite saved state');
set local request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
select is((select count(*)::integer from public.shopper_state),0,'second account cannot read first account state');
select is(public.save_shopper_state('{"profile":{"name":"Second"}}'::jsonb,0),1::bigint,'second account has independent state');
reset role;
delete from auth.users where id='11111111-1111-4111-8111-111111111111';
select is((select count(*)::integer from public.shopper_state where user_id='11111111-1111-4111-8111-111111111111'),0,'deleting an account cascades customer state');
select is((select count(*)::integer from public.shopper_state where user_id='22222222-2222-4222-8222-222222222222'),1,'deletion preserves the other account');
select * from finish();
rollback;
