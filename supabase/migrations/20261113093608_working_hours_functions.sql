-- =============================================================================
-- Migration 8: working-hours functions for the "Ish vaqti" editor (delivery 3b)
--
--   public.replace_working_hours(staff, week)
--       Saves a barber's whole week in ONE step: all-or-nothing.
--   public.count_bookings_outside_new_hours(staff, week)
--       Before saving: how many FUTURE bookings fit the CURRENT hours but would
--       fall outside the NEW hours ("Yangi ish vaqtidan tashqarida N ta yozilish bor").
--
-- Both are SECURITY INVOKER: they run with the CALLER's rights, so every RLS rule
-- still applies (only the owner of an ACTIVE salon can change hours — migrations 4+7).
-- That is also why they don't trigger the "SECURITY DEFINER" advisor warnings.
--
-- `week` format (JSON array, one element per working interval, local salon time):
--   [{"weekday":1,"start":"09:00","end":"13:00"}, {"weekday":1,"start":"14:00","end":"19:00"}, ...]
--   weekday: 1 = Monday … 7 = Sunday (ISO). A day with no elements = day off.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- replace_working_hours
-- Errors (message = code, like the booking functions):
--   NOT_ALLOWED    caller is not the owner of this barber's (active) salon
--   INVALID_HOURS  bad JSON, weekday not 1–7, bad time, end ≤ start, > 50 intervals
--   HOURS_OVERLAP  two intervals overlap on the same day (database EXCLUDE rule)
-- On ANY error nothing is changed (the delete + insert are undone together).
-- -----------------------------------------------------------------------------
create function public.replace_working_hours(p_staff_id uuid, p_week jsonb)
returns setof public.working_hours
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_business_id uuid;
begin
  -- Clear permission error instead of a silent "0 rows" from RLS.
  -- (Invoker functions run as the caller, who may not use the private schema by name,
  --  so we check the caller's own membership row — readable under RLS — directly.)
  select s.business_id into v_business_id from public.staff s where s.id = p_staff_id;
  if v_business_id is null or not exists (
    select 1
    from public.business_members m
    join public.businesses b on b.id = m.business_id and b.is_active
    where m.user_id = (select auth.uid())
      and m.business_id = v_business_id
      and m.role = 'owner'
  ) then
    raise exception using errcode = 'P0001', message = 'NOT_ALLOWED';
  end if;

  if p_week is null or jsonb_typeof(p_week) <> 'array' or jsonb_array_length(p_week) > 50 then
    raise exception using errcode = 'P0001', message = 'INVALID_HOURS';
  end if;

  begin
    delete from public.working_hours where staff_id = p_staff_id;

    insert into public.working_hours (business_id, staff_id, weekday, start_time, end_time)
    select v_business_id, p_staff_id,
           (x ->> 'weekday')::smallint,
           (x ->> 'start')::time,
           (x ->> 'end')::time
    from jsonb_array_elements(p_week) as x;
  exception
    -- (this inner block is a sub-transaction: on error the delete is undone too)
    when exclusion_violation then
      raise exception using errcode = 'P0001', message = 'HOURS_OVERLAP';
    when check_violation or not_null_violation or invalid_text_representation
         or invalid_datetime_format or datetime_field_overflow or numeric_value_out_of_range then
      raise exception using errcode = 'P0001', message = 'INVALID_HOURS';
  end;

  return query
    select wh.* from public.working_hours wh
    where wh.staff_id = p_staff_id
    order by wh.weekday, wh.start_time;
end;
$$;

-- -----------------------------------------------------------------------------
-- count_bookings_outside_new_hours
-- Counts FUTURE pending/confirmed bookings of this barber that are inside the
-- CURRENT working hours but would NOT fit the NEW week. (Bookings that were already
-- outside the hours — e.g. an admin's after-hours walk-in — are not counted again.)
-- Read-only; RLS limits it to bookings the caller may see (the owner: all of the salon).
-- Times are compared in the salon's own timezone.
-- -----------------------------------------------------------------------------
create function public.count_bookings_outside_new_hours(p_staff_id uuid, p_week jsonb)
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  with appts as (
    select
      (a.starts_at at time zone b.timezone) as local_start,
      (a.ends_at at time zone b.timezone) as local_end
    from public.appointments a
    join public.businesses b on b.id = a.business_id
    where a.staff_id = p_staff_id
      and a.status in ('pending', 'confirmed')
      and a.starts_at > now()
  )
  select count(*)::integer
  from appts ap
  where
    -- fits the CURRENT hours …
    exists (
      select 1 from public.working_hours wh
      where wh.staff_id = p_staff_id
        and wh.weekday = extract(isodow from ap.local_start)
        and ap.local_start::date = ap.local_end::date
        and ap.local_start::time >= wh.start_time
        and ap.local_end::time <= wh.end_time
    )
    -- … but not the NEW ones
    and not exists (
      select 1 from jsonb_array_elements(coalesce(p_week, '[]'::jsonb)) as x
      where (x ->> 'weekday')::int = extract(isodow from ap.local_start)
        and ap.local_start::date = ap.local_end::date
        and ap.local_start::time >= (x ->> 'start')::time
        and ap.local_end::time <= (x ->> 'end')::time
    );
$$;

-- -----------------------------------------------------------------------------
-- EXECUTE permissions
--   replace_working_hours            → authenticated (owner check inside + RLS)
--   count_bookings_outside_new_hours → authenticated (read-only, RLS-limited)
--   anon                             → neither
-- -----------------------------------------------------------------------------
revoke execute on function public.replace_working_hours(uuid, jsonb) from public, anon;
grant execute on function public.replace_working_hours(uuid, jsonb) to authenticated;

revoke execute on function public.count_bookings_outside_new_hours(uuid, jsonb) from public, anon;
grant execute on function public.count_bookings_outside_new_hours(uuid, jsonb) to authenticated;
