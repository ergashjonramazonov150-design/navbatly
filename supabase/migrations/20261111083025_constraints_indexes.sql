-- =============================================================================
-- Migration 3: no-overlap (EXCLUDE) constraints + indexes
-- See docs/ARCHITECTURE.md §3.5 and §3.6
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. THE double-booking guarantee
-- -----------------------------------------------------------------------------
-- "For the same staff member, no two ACTIVE appointments may overlap in time."
--   * '[)' = start included, end excluded → 10:00–10:30 and 10:30–11:00 are OK
--   * cancelled appointments are ignored → cancelling frees the slot
--   * checked atomically by Postgres → two simultaneous requests for the same
--     slot: one succeeds, the other fails with error 23P01 (exclusion_violation)
alter table public.appointments
  add constraint appointments_no_overlap
  exclude using gist (
    staff_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  )
  where (status in ('pending', 'confirmed'));

-- -----------------------------------------------------------------------------
-- 2. No overlapping working-hour intervals for the same staff + weekday
-- -----------------------------------------------------------------------------
-- Allowed:  Mon 09:00–13:00 + Mon 14:00–19:00 (lunch break)
-- Rejected: Mon 09:00–13:00 + Mon 12:00–18:00
alter table public.working_hours
  add constraint working_hours_no_overlap
  exclude using gist (
    staff_id with =,
    weekday with =,
    private.timerange(start_time, end_time, '[)') with &&
  );

-- Note: the constraint above calls private.timerange(). That constructor is
-- created automatically by Postgres and is executable by everyone — fine, it
-- only builds a range value and the private schema is not exposed by the API.

-- -----------------------------------------------------------------------------
-- FIX for migration 1: lock down future functions for real
-- -----------------------------------------------------------------------------
-- Migration 1 used per-schema "ALTER DEFAULT PRIVILEGES ... REVOKE ... FROM public".
-- Postgres ignores that part: per-schema defaults can only ADD rights, never
-- remove the global "PUBLIC may execute every function" default.
-- The global (no schema) form below does work. From now on, every new function
-- created by migrations is executable by its owner only, until we GRANT it.
alter default privileges for role postgres revoke execute on functions from public;

-- And fix the one function that already exists. (Trigger functions don't need
-- EXECUTE rights to fire, so triggers keep working.)
revoke execute on function private.set_updated_at() from public;

-- -----------------------------------------------------------------------------
-- 3. Indexes
-- -----------------------------------------------------------------------------
-- Rule: every foreign key gets an index whose leading columns match it
-- (fast joins + fast cascades, and keeps Supabase's advisor clean), plus
-- indexes for the queries we know the app will run.

-- business_members
--   (business_id, user_id) already indexed by its UNIQUE constraint
create index business_members_user_id_idx
  on public.business_members (user_id); -- RLS helpers: "which businesses am I in?" (every request!)
create index business_members_staff_fk_idx
  on public.business_members (staff_id, business_id);

-- staff / services — lists ordered for display
create index staff_business_id_idx on public.staff (business_id, sort_order);
create index services_business_id_idx on public.services (business_id, sort_order);

-- staff_services
create index staff_services_business_id_idx on public.staff_services (business_id);
create index staff_services_staff_fk_idx on public.staff_services (staff_id, business_id);
create index staff_services_service_fk_idx on public.staff_services (service_id, business_id); -- "who does this service?"

-- working_hours — slot calculation looks up (staff, weekday)
create index working_hours_business_id_idx on public.working_hours (business_id);
create index working_hours_staff_fk_idx on public.working_hours (staff_id, business_id, weekday);

-- time_off — slot calculation looks up by staff/business and date
create index time_off_business_id_idx on public.time_off (business_id, starts_at);
create index time_off_staff_fk_idx on public.time_off (staff_id, business_id, starts_at);

-- appointments
create index appointments_business_starts_idx
  on public.appointments (business_id, starts_at); -- admin list & calendar by date
create index appointments_staff_fk_idx
  on public.appointments (staff_id, business_id, starts_at); -- staff's own appointments
create index appointments_service_fk_idx
  on public.appointments (service_id, business_id);
create index appointments_business_phone_idx
  on public.appointments (business_id, customer_phone, starts_at); -- "max N active bookings per phone"
create index appointments_status_changed_by_idx on public.appointments (status_changed_by);
create index appointments_created_by_idx on public.appointments (created_by);

-- private.booking_attempts — rate limiting
create index booking_attempts_ip_created_idx on private.booking_attempts (ip_hash, created_at);
create index booking_attempts_business_id_idx on private.booking_attempts (business_id);
