-- =============================================================================
-- Migration 1: extensions, schemas, types, shared helpers, privilege defaults
-- See docs/ARCHITECTURE.md §3.2 and §4.4
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Extensions
-- -----------------------------------------------------------------------------
-- btree_gist lets one EXCLUDE constraint compare a uuid with "=" AND a time
-- range with "&&" (overlaps). This is what makes double booking impossible.
create extension if not exists btree_gist with schema extensions;

-- -----------------------------------------------------------------------------
-- 2. Private schema
-- -----------------------------------------------------------------------------
-- The Supabase API only exposes the "public" schema. Anything in "private"
-- cannot be called directly from the browser — only used inside the database
-- (RLS policies, triggers, other functions).
create schema if not exists private;

-- -----------------------------------------------------------------------------
-- 3. Lock down future functions
-- -----------------------------------------------------------------------------
-- By default Postgres lets EVERYONE execute every new function, and Supabase
-- additionally grants it to anon/authenticated. We flip that: new functions
-- are private by default; each migration grants access explicitly.
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;
alter default privileges for role postgres in schema private
  revoke execute on functions from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 4. Enum types (fixed lists of allowed values)
-- -----------------------------------------------------------------------------
create type public.member_role as enum ('owner', 'staff');

create type public.appointment_status as enum ('pending', 'confirmed', 'cancelled');

create type public.appointment_source as enum ('online', 'admin');

-- -----------------------------------------------------------------------------
-- 5. Range type over "time of day"
-- -----------------------------------------------------------------------------
-- Postgres has ranges for timestamps but not for plain "time" (09:00–13:00).
-- We need one to stop overlapping working-hour intervals for the same staff
-- member and weekday (e.g. 09:00–13:00 and 12:00–18:00 on Monday).
create type private.timerange as range (subtype = time);

-- -----------------------------------------------------------------------------
-- 6. Shared trigger: keep updated_at current
-- -----------------------------------------------------------------------------
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
