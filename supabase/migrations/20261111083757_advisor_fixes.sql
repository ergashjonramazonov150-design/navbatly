-- =============================================================================
-- Migration 5: fixes for Supabase advisor warnings (after migration 4)
--   A. Security: "function_search_path_mutable" on private.timerange/timemultirange
--   B. Performance: "multiple_permissive_policies" on 4 tables
-- No change in WHO can access WHAT — only how it is implemented.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- A. Replace the custom time-of-day range type with a built-in range
-- -----------------------------------------------------------------------------
-- Same rule as before ("no overlapping intervals for the same staff + weekday"),
-- but we place both times on a fixed dummy date and use the built-in tsrange.
-- Example: 09:00–13:00 → ['2000-01-01 09:00', '2000-01-01 13:00')
-- Built-in functions live in pg_catalog, are safe, and trigger no warnings.
alter table public.working_hours drop constraint working_hours_no_overlap;

alter table public.working_hours
  add constraint working_hours_no_overlap
  exclude using gist (
    staff_id with =,
    weekday with =,
    tsrange(date '2000-01-01' + start_time, date '2000-01-01' + end_time, '[)') with &&
  );

-- Nothing uses the custom type anymore. Dropping it also drops its
-- automatically generated constructor functions (the 5 warnings).
drop type private.timerange;

-- -----------------------------------------------------------------------------
-- B. One SELECT policy per role per table
-- -----------------------------------------------------------------------------
-- Before: logged-in users matched TWO select policies ("public rows" and
-- "my business's rows"), so Postgres evaluated both for every row.
-- After: anon gets the public policy; authenticated gets ONE combined policy.

-- ---- businesses -------------------------------------------------------------
drop policy "Anyone can view active businesses" on public.businesses;
drop policy "Members can view their own business" on public.businesses;

create policy "Visitors can view active businesses"
  on public.businesses for select
  to anon
  using (is_active);

create policy "Users can view active businesses and their own"
  on public.businesses for select
  to authenticated
  using (is_active or id in (select private.my_business_ids()));

-- ---- staff ------------------------------------------------------------------
drop policy "Anyone can view active staff of active businesses" on public.staff;
drop policy "Members can view all staff of their business" on public.staff;

create policy "Visitors can view active staff of active businesses"
  on public.staff for select
  to anon
  using (
    is_active
    and exists (select 1 from public.businesses b where b.id = business_id and b.is_active)
  );

create policy "Users can view public staff and all staff of their business"
  on public.staff for select
  to authenticated
  using (
    (
      is_active
      and exists (select 1 from public.businesses b where b.id = business_id and b.is_active)
    )
    or business_id in (select private.my_business_ids())
  );

-- ---- services ---------------------------------------------------------------
drop policy "Anyone can view active services of active businesses" on public.services;
drop policy "Members can view all services of their business" on public.services;

create policy "Visitors can view active services of active businesses"
  on public.services for select
  to anon
  using (
    is_active
    and exists (select 1 from public.businesses b where b.id = business_id and b.is_active)
  );

create policy "Users can view public services and all services of their business"
  on public.services for select
  to authenticated
  using (
    (
      is_active
      and exists (select 1 from public.businesses b where b.id = business_id and b.is_active)
    )
    or business_id in (select private.my_business_ids())
  );

-- ---- staff_services ---------------------------------------------------------
drop policy "Anyone can view staff-service links of active businesses" on public.staff_services;
drop policy "Members can view staff-service links of their business" on public.staff_services;

create policy "Visitors can view staff-service links of active businesses"
  on public.staff_services for select
  to anon
  using (exists (select 1 from public.businesses b where b.id = business_id and b.is_active));

create policy "Users can view public links and all links of their business"
  on public.staff_services for select
  to authenticated
  using (
    exists (select 1 from public.businesses b where b.id = business_id and b.is_active)
    or business_id in (select private.my_business_ids())
  );
