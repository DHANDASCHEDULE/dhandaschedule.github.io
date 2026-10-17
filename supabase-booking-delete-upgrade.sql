-- Run once in the Supabase SQL Editor to let DHANDA delete inquiries from her private inbox.
-- Deleting an inquiry does not remove or change a calendar slot created by accepting it.

grant delete on public.booking_inquiries to authenticated;

drop policy if exists "Only DHANDA can delete booking inquiries" on public.booking_inquiries;
create policy "Only DHANDA can delete booking inquiries"
  on public.booking_inquiries for delete
  to authenticated
  using ((select auth.jwt() ->> 'email') = 'dhanda@dhandaschedule.github.io');
