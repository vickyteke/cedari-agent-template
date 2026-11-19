-- Private bucket, no client storage policies. Mobile routes validate ownership
-- using the signed customer/guest JWT; outside MCP agents cannot access it.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('agent-chat-images', 'agent-chat-images', false, 262144, array['image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = 262144, allowed_mime_types = array['image/jpeg'];


-- A restrictive policy prevents any broad pre-existing permissive storage policy
-- from granting direct access to private Agent customer photos.
create policy "Agent photos require the customer API"
on storage.objects as restrictive for all to anon, authenticated
using (bucket_id <> 'agent-chat-images')
with check (bucket_id <> 'agent-chat-images');
