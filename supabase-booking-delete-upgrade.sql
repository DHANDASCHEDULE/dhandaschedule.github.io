-- Run once in the Supabase SQL Editor to let DHANDA delete inquiries from her private inbox.
-- Deleting an inquiry does not remove or change a calendar slot created by accepting it.

grant delete on public.booking_inquiries to authenticated;

drop policy if exists "Only DHANDA can delete booking inquiries" on public.booking_inquiries;
create policy "Only DHANDA can delete booking inquiries"
  on public.booking_inquiries for delete
  to authenticated
  using ((select auth.jwt() ->> 'email') = 'dhanda@dhandaschedule.github.io');

-- Use a narrowly scoped RPC for the private inbox delete action. This avoids
-- ambiguous direct-table DELETE permissions and still checks DHANDA's JWT.
create or replace function public.dhanda_delete_booking_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_request_id uuid;
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> 'dhanda@dhandaschedule.github.io' then
    raise exception 'Only DHANDA can delete booking inquiries';
  end if;

  delete from public.booking_inquiries
  where id = p_request_id
  returning id into deleted_request_id;

  if deleted_request_id is null then
    raise exception 'Booking request not found';
  end if;
end;
$$;

revoke all on function public.dhanda_delete_booking_request(uuid) from public, anon;
grant execute on function public.dhanda_delete_booking_request(uuid) to authenticated;
