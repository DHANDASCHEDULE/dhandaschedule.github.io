-- Run this once in the Supabase SQL Editor for DHANDA's calendar project.
-- It creates the public schedule table and restricts every write to DHANDA's auth account.

create table if not exists public.schedule_events (
  id uuid primary key default gen_random_uuid(),
  event_date date not null,
  start_time time without time zone not null,
  end_time time without time zone,
  created_at timestamptz not null default now()
);

create index if not exists schedule_events_date_time_idx
  on public.schedule_events (event_date, start_time);

alter table public.schedule_events enable row level security;

revoke all on public.schedule_events from anon, authenticated;
grant select on public.schedule_events to anon, authenticated;
grant insert, update, delete on public.schedule_events to authenticated;

drop policy if exists "Anyone can view scheduled sets" on public.schedule_events;
create policy "Anyone can view scheduled sets"
  on public.schedule_events for select
  to anon, authenticated
  using (true);

drop policy if exists "Only DHANDA can add scheduled sets" on public.schedule_events;
create policy "Only DHANDA can add scheduled sets"
  on public.schedule_events for insert
  to authenticated
  with check ((select auth.jwt() ->> 'email') = 'dhanda@dhandaschedule.github.io');

drop policy if exists "Only DHANDA can update scheduled sets" on public.schedule_events;
create policy "Only DHANDA can update scheduled sets"
  on public.schedule_events for update
  to authenticated
  using ((select auth.jwt() ->> 'email') = 'dhanda@dhandaschedule.github.io')
  with check ((select auth.jwt() ->> 'email') = 'dhanda@dhandaschedule.github.io');

drop policy if exists "Only DHANDA can remove scheduled sets" on public.schedule_events;
create policy "Only DHANDA can remove scheduled sets"
  on public.schedule_events for delete
  to authenticated
  using ((select auth.jwt() ->> 'email') = 'dhanda@dhandaschedule.github.io');

-- Keep public account sign-up disabled in Supabase Auth settings.
-- Create the one DHANDA user there with email dhanda@dhandaschedule.github.io.
-- Import the supplied October schedule once after creating the table.
