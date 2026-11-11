-- =============================================================================
-- Migration 6: booking functions
-- See docs/ARCHITECTURE.md §6.2
--
--   public.get_available_slots      free start times for the booking page
--   public.create_booking           ONLINE booking (called only by the Edge Function)
--   public.admin_create_appointment manual booking by owner/staff (phone call, walk-in)
--   public.set_appointment_status   confirm / cancel
--
--   private.*                       internal helpers, not callable via the API
--
-- Error handling: every business error is a short CODE (e.g. 'SLOT_TAKEN').
-- The frontend translates codes into Uzbek/Russian text — the database never
-- returns user-facing sentences.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tunable spam limits (one place to change them)
-- -----------------------------------------------------------------------------
-- Per IP limits are deliberately generous: Uzbek mobile operators put many
-- customers behind the same public IP (CGNAT). The per-phone limit
-- (businesses.max_active_bookings_per_phone) is the main per-person limit.
create function private.ip_limit_per_10_minutes() returns int
  language sql immutable set search_path = '' as $$ select 10 $$;
create function private.ip_limit_per_day() returns int
  language sql immutable set search_path = '' as $$ select 50 $$;

-- -----------------------------------------------------------------------------
-- private.customer_input_error — validates name / phone / note
-- Returns NULL if everything is OK, otherwise an error code.
-- (The table CHECK constraints enforce the same rules as a last line of defence.)
-- -----------------------------------------------------------------------------
create function private.customer_input_error(p_name text, p_phone text, p_note text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_name is null or char_length(p_name) not between 2 and 80 then 'INVALID_NAME'
    when p_phone is null or p_phone !~ '^\+998[0-9]{9}$' then 'INVALID_PHONE'
    when p_note is not null and char_length(p_note) > 300 then 'INVALID_NOTE'
    else null
  end;
$$;

-- -----------------------------------------------------------------------------
-- private.check_bookable — is this (business, service, staff) combination bookable?
-- Checks: business active, service active + same business, staff active + same
-- business, staff provides the service. Also returns the service's duration and
-- price, which callers MUST use instead of anything sent by the client.
-- -----------------------------------------------------------------------------
create function private.check_bookable(
  p_business_id uuid,
  p_service_id uuid,
  p_staff_id uuid,
  out error_code text,
  out duration_minutes int,
  out price_uzs int
)
language plpgsql
stable
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.businesses b where b.id = p_business_id and b.is_active
  ) then
    error_code := 'BUSINESS_NOT_FOUND';
    return;
  end if;

  select s.duration_minutes, s.price_uzs
    into duration_minutes, price_uzs
  from public.services s
  where s.id = p_service_id and s.business_id = p_business_id and s.is_active;

  if not found then
    error_code := 'SERVICE_NOT_AVAILABLE';
    return;
  end if;

  if not exists (
    select 1 from public.staff st
    where st.id = p_staff_id and st.business_id = p_business_id and st.is_active
  ) then
    error_code := 'STAFF_NOT_AVAILABLE';
    duration_minutes := null;
    price_uzs := null;
    return;
  end if;

  if not exists (
    select 1 from public.staff_services ss
    where ss.staff_id = p_staff_id and ss.service_id = p_service_id
  ) then
    error_code := 'STAFF_SERVICE_MISMATCH';
    duration_minutes := null;
    price_uzs := null;
    return;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- private.compute_slots — THE slot algorithm (one source of truth)
-- Used by get_available_slots (to show slots) AND create_booking (to verify
-- the chosen slot). Steps:
--   1. date must be within [today, today + booking_horizon_days) in business tz
--   2. take the staff's working intervals for that weekday (local time → timestamptz)
--   3. candidate starts every slot_step_minutes where start + duration <= interval end
--   4. drop starts earlier than now() + min_notice_minutes
--   5. drop slots overlapping time_off (this staff OR whole business)
--   6. drop slots overlapping pending/confirmed appointments of this staff
-- -----------------------------------------------------------------------------
create function private.compute_slots(
  p_business_id uuid,
  p_staff_id uuid,
  p_duration_minutes int,
  p_date date
)
returns setof timestamptz
language sql
stable
set search_path = ''
as $$
  with biz as (
    select
      b.timezone,
      b.slot_step_minutes,
      b.booking_horizon_days,
      b.min_notice_minutes,
      (now() at time zone b.timezone)::date as local_today
    from public.businesses b
    where b.id = p_business_id
  ),
  windows as (
    select
      (p_date + wh.start_time) at time zone biz.timezone as win_start,
      (p_date + wh.end_time) at time zone biz.timezone as win_end,
      biz.slot_step_minutes,
      biz.min_notice_minutes
    from biz
    join public.working_hours wh
      on wh.business_id = p_business_id
     and wh.staff_id = p_staff_id
     and wh.weekday = extract(isodow from p_date)::smallint
    where p_date >= biz.local_today
      and p_date < biz.local_today + biz.booking_horizon_days
  ),
  candidates as (
    select
      gs.slot_start,
      gs.slot_start + make_interval(mins => p_duration_minutes) as slot_end,
      w.min_notice_minutes
    from windows w
    cross join lateral generate_series(
      w.win_start,
      w.win_end - make_interval(mins => p_duration_minutes),
      make_interval(mins => w.slot_step_minutes)
    ) as gs (slot_start)
  )
  select c.slot_start
  from candidates c
  where c.slot_start >= now() + make_interval(mins => c.min_notice_minutes)
    and not exists (
      select 1 from public.time_off t
      where t.business_id = p_business_id
        and (t.staff_id = p_staff_id or t.staff_id is null)
        and tstzrange(t.starts_at, t.ends_at, '[)') && tstzrange(c.slot_start, c.slot_end, '[)')
    )
    and not exists (
      select 1 from public.appointments a
      where a.staff_id = p_staff_id
        and a.status in ('pending', 'confirmed')
        and tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(c.slot_start, c.slot_end, '[)')
    )
  order by c.slot_start;
$$;

-- =============================================================================
-- PUBLIC FUNCTIONS (exposed via the API as /rest/v1/rpc/<name>)
-- All are SECURITY DEFINER: they run with the owner's rights so they can read
-- working hours / appointments that the caller cannot read directly — and they
-- return only what the caller is allowed to see.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- get_available_slots — free start times for one staff + service + local date.
-- Returns ONLY timestamps. Never customer data.
-- Past dates / dates beyond the horizon → empty list (not an error).
-- -----------------------------------------------------------------------------
create function public.get_available_slots(
  p_business_id uuid,
  p_service_id uuid,
  p_staff_id uuid,
  p_date date
)
returns setof timestamptz
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_check record;
begin
  select * into v_check from private.check_bookable(p_business_id, p_service_id, p_staff_id);
  if v_check.error_code is not null then
    raise exception using errcode = 'P0001', message = v_check.error_code;
  end if;

  return query
    select * from private.compute_slots(p_business_id, p_staff_id, v_check.duration_minutes, p_date);
end;
$$;

-- -----------------------------------------------------------------------------
-- create_booking — ONLINE booking. Called ONLY by the create-booking Edge
-- Function (after captcha), never directly by the browser.
--
-- Returns JSON instead of raising errors, so that the spam-counter row it
-- writes is KEPT even when the booking is rejected (a raised error would undo it):
--   { "ok": true,  "appointment": { id, status, starts_at, ends_at, price_uzs } }
--   { "ok": false, "code": "SLOT_TAKEN" }
--
-- The client can NOT choose: status, ends_at, price, source. They are decided here.
-- -----------------------------------------------------------------------------
create function public.create_booking(
  p_business_id uuid,
  p_service_id uuid,
  p_staff_id uuid,
  p_starts_at timestamptz,
  p_customer_name text,
  p_customer_phone text,
  p_customer_note text,
  p_ip_hash text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(regexp_replace(coalesce(p_customer_name, ''), '\s+', ' ', 'g'));
  v_phone text := btrim(p_customer_phone);
  v_note text := nullif(btrim(p_customer_note), '');
  v_input_error text;
  v_check record;
  v_biz public.businesses%rowtype;
  v_local_date date;
  v_active_count int;
  v_row public.appointments%rowtype;
begin
  -- 1. Spam limit per IP (counts every attempt, successful or not)
  if p_ip_hash is null or char_length(p_ip_hash) not between 16 and 128 then
    return jsonb_build_object('ok', false, 'code', 'INVALID_REQUEST');
  end if;

  if (
    select count(*) from private.booking_attempts ba
    where ba.ip_hash = p_ip_hash and ba.created_at > now() - interval '10 minutes'
  ) >= private.ip_limit_per_10_minutes()
  or (
    select count(*) from private.booking_attempts ba
    where ba.ip_hash = p_ip_hash and ba.created_at > now() - interval '1 day'
  ) >= private.ip_limit_per_day() then
    return jsonb_build_object('ok', false, 'code', 'RATE_LIMITED');
  end if;

  if exists (select 1 from public.businesses b where b.id = p_business_id) then
    insert into private.booking_attempts (business_id, ip_hash)
    values (p_business_id, p_ip_hash);
  end if;

  -- 2. Customer input
  v_input_error := private.customer_input_error(v_name, v_phone, v_note);
  if v_input_error is not null then
    return jsonb_build_object('ok', false, 'code', v_input_error);
  end if;

  -- 3. Business / service / staff / staff-service link, all active
  select * into v_check from private.check_bookable(p_business_id, p_service_id, p_staff_id);
  if v_check.error_code is not null then
    return jsonb_build_object('ok', false, 'code', v_check.error_code);
  end if;

  select * into v_biz from public.businesses b where b.id = p_business_id;

  -- 4. Max active future bookings per phone, per business.
  --    The advisory lock makes two simultaneous requests from the same phone
  --    wait for each other, so the limit can't be exceeded by a race.
  perform pg_advisory_xact_lock(hashtextextended(p_business_id::text || ':' || v_phone, 0));

  select count(*) into v_active_count
  from public.appointments a
  where a.business_id = p_business_id
    and a.customer_phone = v_phone
    and a.status in ('pending', 'confirmed')
    and a.starts_at > now();

  if v_active_count >= v_biz.max_active_bookings_per_phone then
    return jsonb_build_object('ok', false, 'code', 'TOO_MANY_BOOKINGS');
  end if;

  -- 5. The chosen start time must be one of the computed free slots
  --    (working hours, time off, min notice, horizon, slot grid, existing bookings)
  if p_starts_at is null then
    return jsonb_build_object('ok', false, 'code', 'INVALID_REQUEST');
  end if;

  v_local_date := (p_starts_at at time zone v_biz.timezone)::date;

  if not exists (
    select 1
    from private.compute_slots(p_business_id, p_staff_id, v_check.duration_minutes, v_local_date) as s (slot_start)
    where s.slot_start = p_starts_at
  ) then
    -- Tell "someone else just took it" apart from "this was never a valid slot"
    if exists (
      select 1 from public.appointments a
      where a.staff_id = p_staff_id
        and a.status in ('pending', 'confirmed')
        and tstzrange(a.starts_at, a.ends_at, '[)')
            && tstzrange(p_starts_at, p_starts_at + make_interval(mins => v_check.duration_minutes), '[)')
    ) then
      return jsonb_build_object('ok', false, 'code', 'SLOT_TAKEN');
    end if;
    return jsonb_build_object('ok', false, 'code', 'SLOT_NOT_AVAILABLE');
  end if;

  -- 6. Insert. Server decides end time, price, status and source.
  --    The EXCLUDE constraint is the final guard against a simultaneous booking.
  begin
    insert into public.appointments (
      business_id, staff_id, service_id,
      starts_at, ends_at,
      status, source,
      customer_name, customer_phone, customer_note,
      price_uzs
    )
    values (
      p_business_id, p_staff_id, p_service_id,
      p_starts_at, p_starts_at + make_interval(mins => v_check.duration_minutes),
      case when v_biz.auto_confirm then 'confirmed' else 'pending' end::public.appointment_status,
      'online',
      v_name, v_phone, v_note,
      v_check.price_uzs
    )
    returning * into v_row;
  exception
    when exclusion_violation then
      return jsonb_build_object('ok', false, 'code', 'SLOT_TAKEN');
  end;

  return jsonb_build_object(
    'ok', true,
    'appointment', jsonb_build_object(
      'id', v_row.id,
      'status', v_row.status,
      'starts_at', v_row.starts_at,
      'ends_at', v_row.ends_at,
      'price_uzs', v_row.price_uzs
    )
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- admin_create_appointment — manual booking (phone call / walk-in).
-- Who: owner of the business, or a staff member booking for THEMSELVES.
-- Differences from online booking (on purpose — the admin is in the salon and
-- knows the situation): no working-hours / slot-grid / min-notice checks and no
-- per-phone limit. Still enforced: active service + staff + link, valid input,
-- sensible time window, and NO OVERLAP (EXCLUDE constraint).
-- Always created as 'confirmed'. Raises errors (message = code).
-- -----------------------------------------------------------------------------
create function public.admin_create_appointment(
  p_service_id uuid,
  p_staff_id uuid,
  p_starts_at timestamptz,
  p_customer_name text,
  p_customer_phone text,
  p_customer_note text default null
)
returns public.appointments
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_business_id uuid;
  v_name text := btrim(regexp_replace(coalesce(p_customer_name, ''), '\s+', ' ', 'g'));
  v_phone text := btrim(p_customer_phone);
  v_note text := nullif(btrim(p_customer_note), '');
  v_input_error text;
  v_check record;
  v_row public.appointments%rowtype;
begin
  select st.business_id into v_business_id from public.staff st where st.id = p_staff_id;

  -- Permission: owner of that business, or the staff member themself.
  -- Unknown staff and "not yours" give the same answer (don't reveal what exists).
  if v_uid is null
     or v_business_id is null
     or not (
       v_business_id in (select private.my_owned_business_ids())
       or p_staff_id in (select private.my_staff_ids())
     ) then
    raise exception using errcode = 'P0001', message = 'NOT_ALLOWED';
  end if;

  v_input_error := private.customer_input_error(v_name, v_phone, v_note);
  if v_input_error is not null then
    raise exception using errcode = 'P0001', message = v_input_error;
  end if;

  select * into v_check from private.check_bookable(v_business_id, p_service_id, p_staff_id);
  if v_check.error_code is not null then
    raise exception using errcode = 'P0001', message = v_check.error_code;
  end if;

  if p_starts_at is null
     or p_starts_at < now() - interval '1 day'
     or p_starts_at > now() + interval '365 days' then
    raise exception using errcode = 'P0001', message = 'INVALID_TIME';
  end if;

  begin
    insert into public.appointments (
      business_id, staff_id, service_id,
      starts_at, ends_at,
      status, source,
      customer_name, customer_phone, customer_note,
      price_uzs,
      created_by, status_changed_at, status_changed_by
    )
    values (
      v_business_id, p_staff_id, p_service_id,
      p_starts_at, p_starts_at + make_interval(mins => v_check.duration_minutes),
      'confirmed', 'admin',
      v_name, v_phone, v_note,
      v_check.price_uzs,
      v_uid, now(), v_uid
    )
    returning * into v_row;
  exception
    when exclusion_violation then
      raise exception using errcode = 'P0001', message = 'SLOT_TAKEN';
  end;

  return v_row;
end;
$$;

-- -----------------------------------------------------------------------------
-- set_appointment_status — confirm or cancel.
-- Who: owner of the business, or the staff member the appointment belongs to.
-- Allowed transitions:  pending → confirmed
--                       pending → cancelled
--                       confirmed → cancelled
-- A cancelled appointment can't be re-activated (book again instead).
-- -----------------------------------------------------------------------------
create function public.set_appointment_status(
  p_appointment_id uuid,
  p_status public.appointment_status,
  p_cancel_reason text default null
)
returns public.appointments
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_reason text := nullif(btrim(p_cancel_reason), '');
  v_row public.appointments%rowtype;
begin
  select * into v_row
  from public.appointments a
  where a.id = p_appointment_id
  for update; -- lock the row so two admins can't change it at the same moment

  if v_uid is null
     or not found
     or not (
       v_row.business_id in (select private.my_owned_business_ids())
       or v_row.staff_id in (select private.my_staff_ids())
     ) then
    raise exception using errcode = 'P0001', message = 'APPOINTMENT_NOT_FOUND';
  end if;

  if not (
    (v_row.status = 'pending' and p_status in ('confirmed', 'cancelled'))
    or (v_row.status = 'confirmed' and p_status = 'cancelled')
  ) then
    raise exception using errcode = 'P0001', message = 'INVALID_STATUS_TRANSITION';
  end if;

  if v_reason is not null and char_length(v_reason) > 200 then
    raise exception using errcode = 'P0001', message = 'INVALID_CANCEL_REASON';
  end if;

  update public.appointments a
  set status = p_status,
      status_changed_at = now(),
      status_changed_by = v_uid,
      cancel_reason = case when p_status = 'cancelled' then v_reason else null end
  where a.id = p_appointment_id
  returning * into v_row;

  return v_row;
end;
$$;

-- =============================================================================
-- EXECUTE permissions — explicit, one line per function per role.
-- (Migration 3 made "nobody but the owner" the default; we still REVOKE
-- explicitly so this file is self-explanatory and safe if defaults change.)
-- =============================================================================

-- Private helpers: nobody via the API. Only the functions above use them
-- (they run as the owner, so they need no extra grant).
revoke execute on function private.ip_limit_per_10_minutes() from public, anon, authenticated;
revoke execute on function private.ip_limit_per_day() from public, anon, authenticated;
revoke execute on function private.customer_input_error(text, text, text) from public, anon, authenticated;
revoke execute on function private.check_bookable(uuid, uuid, uuid) from public, anon, authenticated;
revoke execute on function private.compute_slots(uuid, uuid, int, date) from public, anon, authenticated;

-- get_available_slots: anon + authenticated
revoke execute on function public.get_available_slots(uuid, uuid, uuid, date) from public;
grant execute on function public.get_available_slots(uuid, uuid, uuid, date) to anon, authenticated;

-- create_booking: service_role ONLY (the Edge Function)
revoke execute on function public.create_booking(uuid, uuid, uuid, timestamptz, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.create_booking(uuid, uuid, uuid, timestamptz, text, text, text, text)
  to service_role;

-- admin_create_appointment: authenticated only (permission checked inside)
revoke execute on function public.admin_create_appointment(uuid, uuid, timestamptz, text, text, text)
  from public, anon;
grant execute on function public.admin_create_appointment(uuid, uuid, timestamptz, text, text, text)
  to authenticated;

-- set_appointment_status: authenticated only (permission checked inside)
revoke execute on function public.set_appointment_status(uuid, public.appointment_status, text)
  from public, anon;
grant execute on function public.set_appointment_status(uuid, public.appointment_status, text)
  to authenticated;
