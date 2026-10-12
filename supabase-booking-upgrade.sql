-- Run once in Supabase SQL Editor to enable public booking inquiries and private management.
-- Existing schedule rows become RESERVED; new time slots can be AVAILABLE, RESERVED, or UNAVAILABLE.

alter table public.schedule_events
  add column if not exists status text not null default 'reserved';

do $$
begin
  alter table public.schedule_events
    add constraint schedule_events_status_check
    check (status in ('available', 'reserved', 'unavailable'));
exception when duplicate_object then null;
end $$;

create table if not exists public.booking_inquiries (
  id uuid primary key default gen_random_uuid(),
  club_name text not null check (char_length(trim(club_name)) between 2 and 120),
  contact_name text not null check (char_length(trim(contact_name)) between 2 and 120),
  contact_email text not null check (char_length(trim(contact_email)) between 5 and 320),
  requested_date date not null,
  requested_time time without time zone not null,
  message text not null default '' check (char_length(message) <= 1500),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now()
);

create index if not exists booking_inquiries_created_at_idx
  on public.booking_inquiries (created_at desc);

create index if not exists booking_inquiries_status_idx
  on public.booking_inquiries (status, created_at desc);

alter table public.booking_inquiries enable row level security;

revoke all on public.booking_inquiries from anon, authenticated;
grant insert (club_name, contact_name, contact_email, requested_date, requested_time, message)
  on public.booking_inquiries to anon, authenticated;
grant select, update on public.booking_inquiries to authenticated;

drop policy if exists "Public can send booking inquiries" on public.booking_inquiries;
create policy "Public can send booking inquiries"
  on public.booking_inquiries for insert
  to anon, authenticated
  with check (status = 'pending');

drop policy if exists "Only DHANDA can view booking inquiries" on public.booking_inquiries;
create policy "Only DHANDA can view booking inquiries"
  on public.booking_inquiries for select
  to authenticated
  using ((select auth.jwt() ->> 'email') = 'dhanda@dhandaschedule.github.io');

drop policy if exists "Only DHANDA can update booking inquiries" on public.booking_inquiries;
create policy "Only DHANDA can update booking inquiries"
  on public.booking_inquiries for update
  to authenticated
  using ((select auth.jwt() ->> 'email') = 'dhanda@dhandaschedule.github.io')
  with check ((select auth.jwt() ->> 'email') = 'dhanda@dhandaschedule.github.io');

create or replace function public.dhanda_decide_booking_request(p_request_id uuid, p_decision text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  inquiry public.booking_inquiries%rowtype;
  available_slot_id uuid;
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> 'dhanda@dhandaschedule.github.io' then
    raise exception 'Only DHANDA can decide booking requests';
  end if;

  if p_decision not in ('accepted', 'declined') then
    raise exception 'Decision must be accepted or declined';
  end if;

  select * into inquiry
    from public.booking_inquiries
    where id = p_request_id
    for update;

  if not found then
    raise exception 'Booking request not found';
  end if;

  if inquiry.status <> 'pending' then
    raise exception 'Booking request has already been handled';
  end if;

  if p_decision = 'declined' then
    update public.booking_inquiries set status = 'declined' where id = p_request_id;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtext(inquiry.requested_date::text || 'T' || inquiry.requested_time::text)::bigint);

  if exists (
    select 1 from public.schedule_events
    where event_date = inquiry.requested_date
      and start_time = inquiry.requested_time
      and status in ('reserved', 'unavailable')
  ) then
    raise exception 'This time slot is no longer available';
  end if;

  select id into available_slot_id
    from public.schedule_events
    where event_date = inquiry.requested_date
      and start_time = inquiry.requested_time
      and status = 'available'
    order by id
    limit 1
    for update;

  if available_slot_id is null then
    insert into public.schedule_events (event_date, start_time, status)
      values (inquiry.requested_date, inquiry.requested_time, 'reserved');
  else
    update public.schedule_events set status = 'reserved' where id = available_slot_id;
  end if;

  update public.booking_inquiries set status = 'accepted' where id = p_request_id;
end;
$$;

revoke all on function public.dhanda_decide_booking_request(uuid, text) from public, anon;
grant execute on function public.dhanda_decide_booking_request(uuid, text) to authenticated;
