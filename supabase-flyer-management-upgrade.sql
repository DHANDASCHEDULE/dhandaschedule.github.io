-- Run once in the DHANDA Supabase SQL Editor before publishing the matching site update.
-- Adds editable flyer metadata, drafts, and ordering while preserving flyers already in Storage.

create table if not exists public.party_flyers (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 2 and 100),
  event_date date not null,
  venue text not null default '' check (char_length(venue) <= 120),
  landmark text not null default '' check (char_length(landmark) <= 300),
  description text not null default '' check (char_length(description) <= 500),
  object_path text not null unique,
  is_published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.party_flyers enable row level security;
revoke all on public.party_flyers from anon, authenticated;
grant select on public.party_flyers to anon, authenticated;
grant insert, update, delete on public.party_flyers to authenticated;

drop policy if exists "Public can view published DHANDA flyers" on public.party_flyers;
create policy "Public can view published DHANDA flyers"
  on public.party_flyers for select to anon
  using (is_published);

drop policy if exists "Visitors and DHANDA can view flyer records" on public.party_flyers;
create policy "Visitors and DHANDA can view flyer records"
  on public.party_flyers for select to authenticated
  using (
    is_published
    or (select auth.jwt() ->> 'email') = 'dhanda@dhandaschedule.github.io'
  );

drop policy if exists "Only DHANDA can add flyer records" on public.party_flyers;
create policy "Only DHANDA can add flyer records"
  on public.party_flyers for insert to authenticated
  with check ((select auth.jwt() ->> 'email') = 'dhanda@dhandaschedule.github.io');

drop policy if exists "Only DHANDA can update flyer records" on public.party_flyers;
create policy "Only DHANDA can update flyer records"
  on public.party_flyers for update to authenticated
  using ((select auth.jwt() ->> 'email') = 'dhanda@dhandaschedule.github.io')
  with check ((select auth.jwt() ->> 'email') = 'dhanda@dhandaschedule.github.io');

drop policy if exists "Only DHANDA can remove flyer records" on public.party_flyers;
create policy "Only DHANDA can remove flyer records"
  on public.party_flyers for delete to authenticated
  using ((select auth.jwt() ->> 'email') = 'dhanda@dhandaschedule.github.io');

-- Keep existing uploaded flyers in the gallery and derive initial titles from their filenames.
insert into public.party_flyers (title, event_date, object_path, is_published, sort_order)
select
  initcap(replace(split_part(objects.name, '__', 2), '-', ' ')),
  split_part(objects.name, '__', 1)::date,
  objects.name,
  true,
  row_number() over (
    order by
      case when split_part(objects.name, '__', 1)::date >= current_date then 0 else 1 end,
      case when split_part(objects.name, '__', 1)::date >= current_date
        then split_part(objects.name, '__', 1)::date end asc,
      case when split_part(objects.name, '__', 1)::date < current_date
        then split_part(objects.name, '__', 1)::date end desc
  )::integer
from storage.objects as objects
where objects.bucket_id = 'dhanda-party-flyers'
  and objects.name ~ '^\d{4}-\d{2}-\d{2}__[^/]+__[^/]+\.(jpg|png|webp)$'
on conflict (object_path) do nothing;

create index if not exists party_flyers_public_order_idx
  on public.party_flyers (is_published, sort_order, event_date);
