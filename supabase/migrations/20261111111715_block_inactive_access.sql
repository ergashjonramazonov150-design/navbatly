-- =============================================================================
-- Migration 7: inactive barbers and inactive salons are blocked by the DATABASE
-- (until now only the admin app blocked them — see docs/ARCHITECTURE.md
--  "Known limitations": "Inactive staff = UI block only")
--
-- Rules after this migration:
--   * staff login whose staff profile is inactive → no salon data, no appointments,
--     cannot confirm/cancel/create bookings
--   * any login of a salon that is switched off (businesses.is_active = false)
--     → same, owners included
--   * an owner is NEVER blocked by their own (optional) staff profile being inactive
--   * blocked users can still read THEIR OWN membership, staff profile and salon row,
--     so the app can show "Hisobingiz vaqtincha faolsizlantirilgan"
--
-- How: the three "who am I?" helpers (used by every RLS policy and by
-- admin_create_appointment / set_appointment_status) now skip inactive profiles
-- and inactive salons. Two new "raw" helpers keep the user's own rows visible.
-- CREATE OR REPLACE keeps the existing EXECUTE grants (authenticated only).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. "Who am I?" helpers — now ACTIVE-only
-- -----------------------------------------------------------------------------

-- Salons I may work in: salon active AND (I'm owner OR my staff profile is active
-- OR I have no staff profile)
create or replace function private.my_business_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.business_id
  from public.business_members m
  join public.businesses b on b.id = m.business_id and b.is_active
  left join public.staff s on s.id = m.staff_id
  where m.user_id = (select auth.uid())
    and (m.role = 'owner' or m.staff_id is null or s.is_active);
$$;

-- Salons I own: salon active
create or replace function private.my_owned_business_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.business_id
  from public.business_members m
  join public.businesses b on b.id = m.business_id and b.is_active
  where m.user_id = (select auth.uid())
    and m.role = 'owner';
$$;

-- My bookable staff profiles: profile active AND salon active
create or replace function private.my_staff_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.staff_id
  from public.business_members m
  join public.staff s on s.id = m.staff_id and s.is_active
  join public.businesses b on b.id = m.business_id and b.is_active
  where m.user_id = (select auth.uid());
$$;

-- -----------------------------------------------------------------------------
-- 2. "Raw" helpers — my own rows, active or not (only to SEE them, never to act)
-- -----------------------------------------------------------------------------
create function private.my_membership_business_ids()
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

create function private.my_linked_staff_ids()
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

revoke execute on function private.my_membership_business_ids() from public, anon;
revoke execute on function private.my_linked_staff_ids() from public, anon;
grant execute on function private.my_membership_business_ids() to authenticated;
grant execute on function private.my_linked_staff_ids() to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Two SELECT policies: keep the user's OWN salon row and staff profile visible
-- -----------------------------------------------------------------------------
-- (business_members already shows the user's own row via user_id = auth.uid())

drop policy "Users can view active businesses and their own" on public.businesses;
create policy "Users can view active businesses and their own"
  on public.businesses for select
  to authenticated
  using (is_active or id in (select private.my_membership_business_ids()));

drop policy "Users can view public staff and all staff of their business" on public.staff;
create policy "Users can view public staff, staff of their business, and their own profile"
  on public.staff for select
  to authenticated
  using (
    (
      is_active
      and exists (select 1 from public.businesses b where b.id = business_id and b.is_active)
    )
    or business_id in (select private.my_business_ids())
    or id in (select private.my_linked_staff_ids())
  );
