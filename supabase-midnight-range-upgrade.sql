-- Run once in the Supabase SQL Editor to allow time ranges that end at midnight.
-- A 00:00 end time after a later start time means midnight at the end of that date.

alter table public.schedule_events
  drop constraint if exists schedule_events_time_range_check;

alter table public.schedule_events
  add constraint schedule_events_time_range_check
  check (
    end_time is null
    or end_time > start_time
    or (end_time = time '00:00' and start_time > time '00:00')
  );

alter table public.booking_inquiries
  drop constraint if exists booking_inquiries_time_range_check;

alter table public.booking_inquiries
  add constraint booking_inquiries_time_range_check
  check (
    requested_end_time is null
    or requested_end_time > requested_time
    or (requested_end_time = time '00:00' and requested_time > time '00:00')
  );

create or replace function public.dhanda_decide_booking_request(p_request_id uuid, p_decision text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  inquiry public.booking_inquiries%rowtype;
  requested_end time without time zone;
  requested_start_minute numeric;
  requested_end_minute numeric;
  slot record;
  slot_end_time time without time zone;
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
  requested_start_minute := extract(epoch from inquiry.requested_time) / 60;
  requested_end_minute := case
    when requested_end = time '00:00' and inquiry.requested_time > time '00:00' then 1440
    else extract(epoch from requested_end) / 60
  end;
  if requested_end_minute <= requested_start_minute then
    raise exception 'Booking request must have a valid time range';
  end if;

  perform pg_advisory_xact_lock(hashtext(inquiry.requested_date::text)::bigint);

  if exists (
    select 1 from public.schedule_events
    where event_date = inquiry.requested_date
      and status in ('reserved', 'unavailable')
      and extract(epoch from start_time) / 60 < requested_end_minute
      and (case
        when end_time = time '00:00' and start_time > time '00:00' then 1440
        when end_time is not null then extract(epoch from end_time) / 60
        when start_time >= time '23:59' then extract(epoch from start_time) / 60 + 59.0 / 60
        else extract(epoch from start_time) / 60 + 1
      end) > requested_start_minute
  ) then
    raise exception 'This time range is no longer available';
  end if;

  for slot in
    select id, start_time, end_time,
      extract(epoch from start_time) / 60 as start_minute,
      case
        when end_time = time '00:00' and start_time > time '00:00' then 1440
        when end_time is not null then extract(epoch from end_time) / 60
        when start_time >= time '23:59' then extract(epoch from start_time) / 60 + 59.0 / 60
        else extract(epoch from start_time) / 60 + 1
      end as end_minute
    from public.schedule_events
    where event_date = inquiry.requested_date
      and status = 'available'
      and extract(epoch from start_time) / 60 < requested_end_minute
      and (case
        when end_time = time '00:00' and start_time > time '00:00' then 1440
        when end_time is not null then extract(epoch from end_time) / 60
        when start_time >= time '23:59' then extract(epoch from start_time) / 60 + 59.0 / 60
        else extract(epoch from start_time) / 60 + 1
      end) > requested_start_minute
    order by start_time
    for update
  loop
    slot_end_time := coalesce(
      slot.end_time,
      case
        when slot.start_time >= time '23:59' then time '23:59:59'
        else slot.start_time + interval '1 minute'
      end
    );
    delete from public.schedule_events where id = slot.id;

    if slot.start_minute < requested_start_minute then
      insert into public.schedule_events (event_date, start_time, end_time, status)
        values (inquiry.requested_date, slot.start_time, inquiry.requested_time, 'available');
    end if;

    if slot.end_minute > requested_end_minute then
      insert into public.schedule_events (event_date, start_time, end_time, status)
        values (inquiry.requested_date, requested_end, slot_end_time, 'available');
    end if;
  end loop;

  insert into public.schedule_events (event_date, start_time, end_time, status)
    values (inquiry.requested_date, inquiry.requested_time, requested_end, 'reserved');

  update public.booking_inquiries set status = 'accepted' where id = p_request_id;
end;
$$;

revoke all on function public.dhanda_decide_booking_request(uuid, text) from public, anon;
grant execute on function public.dhanda_decide_booking_request(uuid, text) to authenticated;
