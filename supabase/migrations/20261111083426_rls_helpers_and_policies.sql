-- =============================================================================
-- Migration 4: access control — table privileges (GRANT) + RLS helpers + policies
-- See docs/ARCHITECTURE.md §4
--
-- Two locks on every table:
--   Lock 1 — GRANT:  WHICH ACTIONS a role may attempt at all (select/insert/...)
--   Lock 2 — RLS:    WHICH ROWS that action may touch
-- Both must say yes. Supabase grants ALL actions (even TRUNCATE, which ignores
-- RLS) to anon/authenticated by default, so we first take everything away and
-- then grant back the minimum.
--
-- service_role (Edge Functions only) keeps full rights and bypasses RLS.
-- Appointment writes are NOT granted to anyone here: they go through the
-- database functions in migration 5.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Lock 1 — take away all default table rights from API roles
-- -----------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;

-- Future tables in public: no automatic rights for anon/authenticated either.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. Lock 1 — grant back the minimum
-- -----------------------------------------------------------------------------
-- Public visitor (anon): read the catalogue needed by the booking page.
grant select on public.businesses, public.staff, public.services, public.staff_services
  to anon;

-- Logged-in owner/staff (authenticated): read everything of their business
-- (RLS narrows it down to the right rows).
grant select on
  public.businesses, public.staff, public.services, public.staff_services,
  public.business_members, public.working_hours, public.time_off,
  public.appointments, public.business_telegram_settings
  to authenticated;

-- Owner-managed data (RLS allows only owners to actually write).
-- No DELETE on staff/services: deactivate (is_active = false) instead.
grant insert on public.staff, public.services to authenticated;
grant update (full_name, photo_url, bio, is_active, sort_order) on public.staff to authenticated;
grant update (name, description, duration_minutes, price_uzs, is_active, sort_order)
  on public.services to authenticated;

grant insert, delete on public.staff_services to authenticated;

grant insert, delete on public.working_hours, public.time_off to authenticated;
grant update (weekday, start_time, end_time) on public.working_hours to authenticated;
grant update (staff_id, starts_at, ends_at, reason) on public.time_off to authenticated;

grant insert on public.business_telegram_settings to authenticated;
grant update (chat_id, is_enabled) on public.business_telegram_settings to authenticated;

-- Business settings an owner may change. NOT included on purpose:
-- slug (would break shared links), timezone, is_active — platform admin only.
grant update (
  name, phone, address, default_locale, slot_step_minutes, booking_horizon_days,
  min_notice_minutes, max_active_bookings_per_phone, auto_confirm
) on public.businesses to authenticated;

-- business_members and appointments: read-only for authenticated (see above).

-- -----------------------------------------------------------------------------
-- 3. RLS helper functions ("who am I?")
-- -----------------------------------------------------------------------------
-- Each returns a SET of ids, so policies can use "business_id in (select ...)".
-- Postgres then runs the helper ONCE per query, not once per row (fast).
--
-- SECURITY DEFINER: they run with the owner's rights, so they can read
-- business_members even though business_members itself is protected by RLS
-- (otherwise its policy would call the helper, which would hit the policy...
-- an infinite loop). search_path = '' prevents search-path hijacking.

-- Businesses I belong to (as owner or staff)
create function private.my_business_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.business_id
  from public.business_members m
  where m.user_id = (select auth.uid());
$$;

-- Businesses where I am OWNER
create function private.my_owned_business_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.business_id
  from public.business_members m
  where m.user_id = (select auth.uid())
    and m.role = 'owner';
$$;

-- Staff profiles linked to my login (business_members.staff_id)
create function private.my_staff_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.staff_id
  from public.business_members m
  where m.user_id = (select auth.uid())
    and m.staff_id is not null;
$$;

-- Only logged-in users' policies call these. anon never needs them.
grant execute on function private.my_business_ids() to authenticated;
grant execute on function private.my_owned_business_ids() to authenticated;
grant execute on function private.my_staff_ids() to authenticated;

-- -----------------------------------------------------------------------------
-- 4. Lock 2 — RLS policies
-- -----------------------------------------------------------------------------
-- Reminder: RLS is already ON for every table (migration 2). No matching
-- policy = no access.

-- ---- businesses -------------------------------------------------------------
create policy "Anyone can view active businesses"
  on public.businesses for select
  to anon, authenticated
  using (is_active);

create policy "Members can view their own business"
  on public.businesses for select
  to authenticated
  using (id in (select private.my_business_ids()));

create policy "Owners can update their business"
  on public.businesses for update
  to authenticated
  using (id in (select private.my_owned_business_ids()))
  with check (id in (select private.my_owned_business_ids()));

-- ---- business_members -------------------------------------------------------
create policy "Users see their own membership; owners see all members"
  on public.business_members for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or business_id in (select private.my_owned_business_ids())
  );

-- ---- staff ------------------------------------------------------------------
create policy "Anyone can view active staff of active businesses"
  on public.staff for select
  to anon, authenticated
  using (
    is_active
    and exists (select 1 from public.businesses b where b.id = business_id and b.is_active)
  );

create policy "Members can view all staff of their business"
  on public.staff for select
  to authenticated
  using (business_id in (select private.my_business_ids()));

create policy "Owners can add staff"
  on public.staff for insert
  to authenticated
  with check (business_id in (select private.my_owned_business_ids()));

create policy "Owners can update staff"
  on public.staff for update
  to authenticated
  using (business_id in (select private.my_owned_business_ids()))
  with check (business_id in (select private.my_owned_business_ids()));

-- ---- services ---------------------------------------------------------------
create policy "Anyone can view active services of active businesses"
  on public.services for select
  to anon, authenticated
  using (
    is_active
    and exists (select 1 from public.businesses b where b.id = business_id and b.is_active)
  );

create policy "Members can view all services of their business"
  on public.services for select
  to authenticated
  using (business_id in (select private.my_business_ids()));

create policy "Owners can add services"
  on public.services for insert
  to authenticated
  with check (business_id in (select private.my_owned_business_ids()));

create policy "Owners can update services"
  on public.services for update
  to authenticated
  using (business_id in (select private.my_owned_business_ids()))
  with check (business_id in (select private.my_owned_business_ids()));

-- ---- staff_services ---------------------------------------------------------
create policy "Anyone can view staff-service links of active businesses"
  on public.staff_services for select
  to anon, authenticated
  using (exists (select 1 from public.businesses b where b.id = business_id and b.is_active));

create policy "Members can view staff-service links of their business"
  on public.staff_services for select
  to authenticated
  using (business_id in (select private.my_business_ids()));

create policy "Owners can add staff-service links"
  on public.staff_services for insert
  to authenticated
  with check (business_id in (select private.my_owned_business_ids()));

create policy "Owners can remove staff-service links"
  on public.staff_services for delete
  to authenticated
  using (business_id in (select private.my_owned_business_ids()));

-- ---- working_hours ----------------------------------------------------------
-- Not readable by anon: the booking page gets free slots from a function (migration 5).
create policy "Members can view working hours"
  on public.working_hours for select
  to authenticated
  using (business_id in (select private.my_business_ids()));

create policy "Owners can add working hours"
  on public.working_hours for insert
  to authenticated
  with check (business_id in (select private.my_owned_business_ids()));

create policy "Owners can update working hours"
  on public.working_hours for update
  to authenticated
  using (business_id in (select private.my_owned_business_ids()))
  with check (business_id in (select private.my_owned_business_ids()));

create policy "Owners can delete working hours"
  on public.working_hours for delete
  to authenticated
  using (business_id in (select private.my_owned_business_ids()));

-- ---- time_off ---------------------------------------------------------------
create policy "Members can view time off"
  on public.time_off for select
  to authenticated
  using (business_id in (select private.my_business_ids()));

create policy "Owners can add time off"
  on public.time_off for insert
  to authenticated
  with check (business_id in (select private.my_owned_business_ids()));

create policy "Owners can update time off"
  on public.time_off for update
  to authenticated
  using (business_id in (select private.my_owned_business_ids()))
  with check (business_id in (select private.my_owned_business_ids()));

create policy "Owners can delete time off"
  on public.time_off for delete
  to authenticated
  using (business_id in (select private.my_owned_business_ids()));

-- ---- appointments -----------------------------------------------------------
-- Read only. Owners: every appointment of their business.
-- Staff: only appointments assigned to their own staff profile.
-- anon: nothing at all (customer names and phone numbers are private).
create policy "Owners see all appointments; staff see their own"
  on public.appointments for select
  to authenticated
  using (
    business_id in (select private.my_owned_business_ids())
    or staff_id in (select private.my_staff_ids())
  );

-- ---- business_telegram_settings (owners only) -------------------------------
create policy "Owners can view telegram settings"
  on public.business_telegram_settings for select
  to authenticated
  using (business_id in (select private.my_owned_business_ids()));

create policy "Owners can create telegram settings"
  on public.business_telegram_settings for insert
  to authenticated
  with check (business_id in (select private.my_owned_business_ids()));

create policy "Owners can update telegram settings"
  on public.business_telegram_settings for update
  to authenticated
  using (business_id in (select private.my_owned_business_ids()))
  with check (business_id in (select private.my_owned_business_ids()));

-- ---- private.booking_attempts -----------------------------------------------
-- No grants, no policies: only database functions (migration 5) touch it.
