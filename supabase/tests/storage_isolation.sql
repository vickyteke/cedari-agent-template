begin;
create extension if not exists pgtap with schema extensions;
select plan(3);
select is((select file_size_limit from storage.buckets where id='agent-chat-images'),262144::bigint,'normalized image size is bounded');
select is((select allowed_mime_types from storage.buckets where id='agent-chat-images'),array['image/jpeg']::text[],'only JPEG objects are allowed');
select ok(exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and permissive='RESTRICTIVE' and qual like '%agent-chat-images%'),'restrictive policy blocks broad client storage grants');
select * from finish();
rollback;
