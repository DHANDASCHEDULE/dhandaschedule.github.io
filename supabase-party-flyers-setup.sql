-- Run once in the Supabase SQL Editor to enable DHANDA's public party-flyer gallery.
-- Visitors can view/list flyers. Only DHANDA can upload or remove them.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'dhanda-party-flyers',
  'dhanda-party-flyers',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can view DHANDA party flyers" on storage.objects;
create policy "Public can view DHANDA party flyers"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'dhanda-party-flyers');

drop policy if exists "Only DHANDA can upload party flyers" on storage.objects;
create policy "Only DHANDA can upload party flyers"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'dhanda-party-flyers'
    and (select auth.jwt() ->> 'email') = 'dhanda@dhandaschedule.github.io'
  );

drop policy if exists "Only DHANDA can remove party flyers" on storage.objects;
create policy "Only DHANDA can remove party flyers"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'dhanda-party-flyers'
    and (select auth.jwt() ->> 'email') = 'dhanda@dhandaschedule.github.io'
  );
