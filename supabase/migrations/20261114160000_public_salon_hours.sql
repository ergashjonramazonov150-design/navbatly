-- =============================================================================
-- Migration 11: public opening hours for the booking page (desktop layout, left column)
--
--   public.get_salon_hours(business_id) → one row per OPEN weekday:
--       weekday (1 = Monday … 7 = Sunday), opens, closes (local salon time)
--   opens  = the earliest start of any ACTIVE barber that day
--   closes = the latest end of any ACTIVE barber that day
--   A weekday with no row = the salon is closed that day.
--
-- Why a function: visitors (anon) can't read working_hours (RLS — per-barber schedules
-- are staff data). This returns ONLY the salon-wide summary, never per-barber rows,
-- and only for ACTIVE salons (an inactive salon returns nothing).
-- SECURITY DEFINER like get_available_slots; search_path pinned; anon + authenticated.
-- =============================================================================
create function public.get_salon_hours(p_business_id uuid)
returns table (weekday smallint, opens time, closes time)
language sql
stable
security definer
set search_path = ''
as $$
  select wh.weekday, min(wh.start_time), max(wh.end_time)
  from public.working_hours wh
  join public.staff s on s.id = wh.staff_id and s.is_active
  join public.businesses b on b.id = wh.business_id and b.is_active
  where wh.business_id = p_business_id
  group by wh.weekday
  order by wh.weekday
$$;

revoke execute on function public.get_salon_hours(uuid) from public;
grant execute on function public.get_salon_hours(uuid) to anon, authenticated;
