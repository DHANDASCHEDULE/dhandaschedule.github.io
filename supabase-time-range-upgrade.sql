-- Run once in the Supabase SQL Editor before publishing the matching website update.
-- Adds availability ranges and the booking-request contact details requested by DHANDA.

alter table public.schedule_events
  add column if not exists end_time time without time zone;

do $$
begin
  alter table public.schedule_events
    add constraint schedule_events_time_range_check
    check (end_time is null or end_time > start_time);
exception when duplicate_object then null;
end $$;

alter table public.booking_inquiries
  add column if not exists requested_end_time time without time zone,
  add column if not exists discord_handle text not null default '',
  add column if not exists landmark text not null default '';

alter table public.booking_inquiries
  alter column contact_email drop not null;

alter table public.booking_inquiries
  drop constraint if exists booking_inquiries_contact_email_check;

alter table public.booking_inquiries
  add constraint booking_inquiries_contact_email_check
  check (contact_email is null or char_length(trim(contact_email)) between 5 and 320);

do $$
begin
  alter table public.booking_inquiries
    add constraint booking_inquiries_time_range_check
    check (requested_end_time is null or requested_end_time > requested_time);
exception when duplicate_object then null;
end $$;

grant insert (club_name, contact_name, contact_email, discord_handle, landmark,
  requested_date, requested_time, requested_end_time, message)
  on public.booking_inquiries to anon, authenticated;

create or replace function public.dhanda_decide_booking_request(p_request_id uuid, p_decision text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  inquiry public.booking_inquiries%rowtype;
  requested_end time without time zone;
  slot record;
  slot_end time without time zone;
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

  requested_end := coalesce(
    inquiry.requested_end_time,
    case
      when inquiry.requested_time >= time '23:59' then time '23:59:59'
      when inquiry.requested_time >= time '23:00' then time '23:59'
      else inquiry.requested_time + interval '1 hour'
    end
  );
  if requested_end <= inquiry.requested_time then
    raise exception 'Booking request must have a valid time range';
  end if;

  -- Serialize all booking decisions on the same date so overlapping intervals cannot both be accepted.
  perform pg_advisory_xact_lock(hashtext(inquiry.requested_date::text)::bigint);

  if exists (
    select 1 from public.schedule_events
    where event_date = inquiry.requested_date
      and status in ('reserved', 'unavailable')
      and start_time < requested_end
      and (case
        when end_time is not null then end_time
        when start_time >= time '23:59' then time '23:59:59'
        else start_time + interval '1 minute'
      end) > inquiry.requested_time
  ) then
    raise exception 'This time range is no longer available';
  end if;

  -- If an available interval overlaps the accepted request, keep any free time on either side.
  for slot in
    select id, start_time, end_time
    from public.schedule_events
    where event_date = inquiry.requested_date
      and status = 'available'
      and start_time < requested_end
      and (case
        when end_time is not null then end_time
        when start_time >= time '23:59' then time '23:59:59'
        else start_time + interval '1 minute'
      end) > inquiry.requested_time
    order by start_time
    for update
  loop
    slot_end := coalesce(
      slot.end_time,
      case
        when slot.start_time >= time '23:59' then time '23:59:59'
        else slot.start_time + interval '1 minute'
      end
    );
    delete from public.schedule_events where id = slot.id;

    if slot.start_time < inquiry.requested_time then
      insert into public.schedule_events (event_date, start_time, end_time, status)
        values (inquiry.requested_date, slot.start_time, inquiry.requested_time, 'available');
    end if;

    if slot_end > requested_end then
      insert into public.schedule_events (event_date, start_time, end_time, status)
        values (inquiry.requested_date, requested_end, slot_end, 'available');
    end if;
  end loop;

  insert into public.schedule_events (event_date, start_time, end_time, status)
    values (inquiry.requested_date, inquiry.requested_time, requested_end, 'reserved');

  update public.booking_inquiries set status = 'accepted' where id = p_request_id;
end;
$$;

revoke all on function public.dhanda_decide_booking_request(uuid, text) from public, anon;
grant execute on function public.dhanda_decide_booking_request(uuid, text) to authenticated;
