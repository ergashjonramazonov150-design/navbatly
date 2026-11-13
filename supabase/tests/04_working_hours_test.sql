-- =============================================================================
-- 04 — Working hours: replace_working_hours + booking-impact warning (migration 8)
-- Runs inside a transaction that is ROLLED BACK: nothing is left behind.
-- Run: npm run db:test
-- =============================================================================
begin;

-- ===== FIXTURES (same in every test file) ====================================
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
grant usage on schema extensions to anon, authenticated, service_role;
grant execute on all functions in schema extensions to anon, authenticated, service_role;

create schema tests;
grant usage on schema tests to anon, authenticated, service_role;

-- every assertion stores its TAP line here; scripts/db-test.mjs prints them
create table tests.tap (line text, at timestamptz not null default clock_timestamp());
grant select, insert on tests.tap to anon, authenticated, service_role;

-- local date / time in Asia/Tashkent, relative to today
create function tests.day(p_offset int) returns date language sql stable as $$
  select (now() at time zone 'Asia/Tashkent')::date + p_offset
$$;
create function tests.at(p_offset int, p_time time) returns timestamptz language sql stable as $$
  select (tests.day(p_offset) + p_time) at time zone 'Asia/Tashkent'
$$;
-- pretend to be a logged-in user / an anonymous visitor
create function tests.login_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function tests.login_as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
end $$;
grant execute on all functions in schema tests to anon, authenticated, service_role;

-- users
insert into auth.users (id, email, aud, role) values
  ('a0000000-0000-0000-0000-0000000000a0', 'owner-a@test.local',  'authenticated', 'authenticated'),
  ('a0000000-0000-0000-0000-0000000000a1', 'jasur-a@test.local',  'authenticated', 'authenticated'),
  ('a0000000-0000-0000-0000-0000000000a2', 'bobur-a@test.local',  'authenticated', 'authenticated'),
  ('b0000000-0000-0000-0000-0000000000b0', 'owner-b@test.local',  'authenticated', 'authenticated');

-- businesses: A and B
insert into public.businesses (id, name, slug, phone) values
  ('10000000-0000-0000-0000-00000000000a', 'Test Salon A', 'test-salon-a', '+998901112233'),
  ('10000000-0000-0000-0000-00000000000b', 'Test Salon B', 'test-salon-b', null);

-- staff: Jasur (A), Bobur (A), inactive (A), Akmal (B)
insert into public.staff (id, business_id, full_name, is_active) values
  ('20000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-00000000000a', 'Jasur', true),
  ('20000000-0000-0000-0000-0000000000a2', '10000000-0000-0000-0000-00000000000a', 'Bobur', true),
  ('20000000-0000-0000-0000-0000000000a3', '10000000-0000-0000-0000-00000000000a', 'Inactive', false),
  ('20000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-00000000000b', 'Akmal', true);

-- services: haircut 30m (A), beard 20m (A), inactive (A), haircut (B)
insert into public.services (id, business_id, name, duration_minutes, price_uzs, is_active) values
  ('30000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-00000000000a', 'Soch olish', 30, 80000, true),
  ('30000000-0000-0000-0000-0000000000a2', '10000000-0000-0000-0000-00000000000a', 'Soqol',      20, 50000, true),
  ('30000000-0000-0000-0000-0000000000a3', '10000000-0000-0000-0000-00000000000a', 'Eski',       30, 10000, false),
  ('30000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-00000000000b', 'Soch olish', 30, 70000, true);

-- who does what: Jasur → haircut (+inactive); Bobur → haircut + beard; Akmal → B haircut
insert into public.staff_services (business_id, staff_id, service_id) values
  ('10000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-0000000000a1', '30000000-0000-0000-0000-0000000000a1'),
  ('10000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-0000000000a1', '30000000-0000-0000-0000-0000000000a3'),
  ('10000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-0000000000a2', '30000000-0000-0000-0000-0000000000a1'),
  ('10000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-0000000000a2', '30000000-0000-0000-0000-0000000000a2'),
  ('10000000-0000-0000-0000-00000000000b', '20000000-0000-0000-0000-0000000000b1', '30000000-0000-0000-0000-0000000000b1');

-- working hours: every day 09:00–13:00 and 14:00–19:00 (lunch 13–14)
insert into public.working_hours (business_id, staff_id, weekday, start_time, end_time)
select s.business_id, s.id, d, w.start_time, w.end_time
from public.staff s
cross join generate_series(1, 7) as d
cross join (values (time '09:00', time '13:00'), (time '14:00', time '19:00')) as w (start_time, end_time)
where s.id in ('20000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-0000000000a2',
               '20000000-0000-0000-0000-0000000000b1');

-- logins: owner A, Jasur (staff, linked), Bobur (staff, linked), owner B
insert into public.business_members (business_id, user_id, role, staff_id) values
  ('10000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-0000000000a0', 'owner', null),
  ('10000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-0000000000a1', 'staff', '20000000-0000-0000-0000-0000000000a1'),
  ('10000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-0000000000a2', 'staff', '20000000-0000-0000-0000-0000000000a2'),
  ('10000000-0000-0000-0000-00000000000b', 'b0000000-0000-0000-0000-0000000000b0', 'owner', null);

insert into public.business_telegram_settings (business_id, chat_id, is_enabled) values
  ('10000000-0000-0000-0000-00000000000a', '111111', true),
  ('10000000-0000-0000-0000-00000000000b', '222222', true);
-- ===== END FIXTURES ==========================================================

-- Jasur: a future booking on day+2 at 10:00–10:30 (inside his current 09:00–13:00),
-- plus an after-hours admin walk-in at 20:00 (already OUTSIDE current hours)
-- and a booking in the PAST (must never be counted).
insert into public.appointments
  (business_id, staff_id, service_id, starts_at, ends_at, status, source, customer_name, customer_phone, price_uzs)
values
  ('10000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-0000000000a1', '30000000-0000-0000-0000-0000000000a1',
   tests.at(2, '10:00'), tests.at(2, '10:30'), 'pending', 'online', 'Ali', '+998901234567', 80000),
  ('10000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-0000000000a1', '30000000-0000-0000-0000-0000000000a1',
   tests.at(2, '20:00'), tests.at(2, '20:30'), 'confirmed', 'admin', 'Walk-in', '+998901234568', 80000),
  ('10000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-0000000000a1', '30000000-0000-0000-0000-0000000000a1',
   tests.at(-2, '10:00'), tests.at(-2, '10:30'), 'confirmed', 'online', 'Old', '+998901234569', 80000);

-- helper: the weekday (1–7) of day+2 in Tashkent, and a week JSON builder
create function tests.wd(p_offset int) returns int language sql stable as $$
  select extract(isodow from tests.day(p_offset))::int
$$;
grant execute on function tests.wd(int) to authenticated;

select no_plan();

-- =============================================================================
-- 1. count_bookings_outside_new_hours (owner A)
-- =============================================================================
select tests.login_as('a0000000-0000-0000-0000-0000000000a0');

insert into tests.tap select is(
  public.count_bookings_outside_new_hours('20000000-0000-0000-0000-0000000000a1',
    jsonb_build_array(jsonb_build_object('weekday', tests.wd(2), 'start', '09:00', 'end', '13:00'))),
  0, 'warning: same morning hours → 0 bookings affected');

insert into tests.tap select is(
  public.count_bookings_outside_new_hours('20000000-0000-0000-0000-0000000000a1',
    jsonb_build_array(jsonb_build_object('weekday', tests.wd(2), 'start', '10:15', 'end', '13:00'))),
  1, 'warning: start moved to 10:15 → the 10:00 booking is now outside → 1');

insert into tests.tap select is(
  public.count_bookings_outside_new_hours('20000000-0000-0000-0000-0000000000a1', '[]'::jsonb),
  1, 'warning: whole week off → 1 (the after-hours walk-in and the past booking are NOT counted)');

insert into tests.tap select is(
  public.count_bookings_outside_new_hours('20000000-0000-0000-0000-0000000000a1',
    jsonb_build_array(jsonb_build_object('weekday', tests.wd(2), 'start', '10:00', 'end', '10:30'))),
  0, 'warning: booking exactly fills the new interval (10:00–10:30) → still fits → 0');

-- =============================================================================
-- 2. replace_working_hours — success paths (owner A)
-- =============================================================================
insert into tests.tap select is(
  (select count(*) from public.replace_working_hours('20000000-0000-0000-0000-0000000000a1',
    '[{"weekday":1,"start":"10:00","end":"14:00"},{"weekday":1,"start":"15:00","end":"19:00"},
      {"weekday":2,"start":"10:00","end":"19:00"}]'::jsonb)),
  3::bigint, 'save: new week (Mon with lunch break + Tue) → returns 3 rows');

insert into tests.tap select is(
  (select count(*) from public.working_hours where staff_id = '20000000-0000-0000-0000-0000000000a1'),
  3::bigint, 'save: OLD hours replaced completely (was 14 rows, now 3)');

insert into tests.tap select is(
  (select count(*) from public.replace_working_hours('20000000-0000-0000-0000-0000000000a1', '[]'::jsonb)),
  0::bigint, 'save: empty week allowed (barber off all week)');

-- restore a normal week for the next checks
select public.replace_working_hours('20000000-0000-0000-0000-0000000000a1',
  '[{"weekday":1,"start":"09:00","end":"13:00"},{"weekday":2,"start":"09:00","end":"13:00"}]'::jsonb);

-- =============================================================================
-- 3. replace_working_hours — all-or-nothing on errors
-- =============================================================================
insert into tests.tap select throws_ok(
  $$select public.replace_working_hours('20000000-0000-0000-0000-0000000000a1',
    '[{"weekday":1,"start":"09:00","end":"13:00"},{"weekday":1,"start":"12:00","end":"18:00"}]'::jsonb)$$,
  'P0001', 'HOURS_OVERLAP', 'error: overlapping intervals → HOURS_OVERLAP');
insert into tests.tap select is(
  (select count(*) from public.working_hours where staff_id = '20000000-0000-0000-0000-0000000000a1'),
  2::bigint, 'error: after HOURS_OVERLAP the previous 2 rows are untouched (nothing half-saved)');

insert into tests.tap select throws_ok(
  $$select public.replace_working_hours('20000000-0000-0000-0000-0000000000a1',
    '[{"weekday":1,"start":"18:00","end":"09:00"}]'::jsonb)$$,
  'P0001', 'INVALID_HOURS', 'error: end before start → INVALID_HOURS');
insert into tests.tap select throws_ok(
  $$select public.replace_working_hours('20000000-0000-0000-0000-0000000000a1',
    '[{"weekday":8,"start":"09:00","end":"13:00"}]'::jsonb)$$,
  'P0001', 'INVALID_HOURS', 'error: weekday 8 → INVALID_HOURS');
insert into tests.tap select throws_ok(
  $$select public.replace_working_hours('20000000-0000-0000-0000-0000000000a1',
    '[{"weekday":1,"start":"nine","end":"13:00"}]'::jsonb)$$,
  'P0001', 'INVALID_HOURS', 'error: not a time → INVALID_HOURS');
insert into tests.tap select throws_ok(
  $$select public.replace_working_hours('20000000-0000-0000-0000-0000000000a1', '{"weekday":1}'::jsonb)$$,
  'P0001', 'INVALID_HOURS', 'error: not an array → INVALID_HOURS');
insert into tests.tap select is(
  (select count(*) from public.working_hours where staff_id = '20000000-0000-0000-0000-0000000000a1'),
  2::bigint, 'error: after every failed save the hours are still the previous 2 rows');

-- =============================================================================
-- 4. Permissions
-- =============================================================================
select tests.login_as('a0000000-0000-0000-0000-0000000000a1'); -- Jasur (staff)
insert into tests.tap select throws_ok(
  $$select public.replace_working_hours('20000000-0000-0000-0000-0000000000a1', '[]'::jsonb)$$,
  'P0001', 'NOT_ALLOWED', 'permission: a barber cannot change even his own hours');

select tests.login_as('b0000000-0000-0000-0000-0000000000b0'); -- owner B
insert into tests.tap select throws_ok(
  $$select public.replace_working_hours('20000000-0000-0000-0000-0000000000a1', '[]'::jsonb)$$,
  'P0001', 'NOT_ALLOWED', 'permission: owner of ANOTHER salon cannot change Jasur''s hours');
insert into tests.tap select is(
  public.count_bookings_outside_new_hours('20000000-0000-0000-0000-0000000000a1', '[]'::jsonb),
  0, 'permission: owner B sees 0 of salon A''s bookings in the warning count (RLS)');

select tests.login_as_anon();
insert into tests.tap select throws_ok(
  $$select public.replace_working_hours('20000000-0000-0000-0000-0000000000a1', '[]'::jsonb)$$,
  '42501', null, 'permission: anon cannot call replace_working_hours');
insert into tests.tap select throws_ok(
  $$select public.count_bookings_outside_new_hours('20000000-0000-0000-0000-0000000000a1', '[]'::jsonb)$$,
  '42501', null, 'permission: anon cannot call count_bookings_outside_new_hours');

set local role postgres;
update public.businesses set is_active = false where id = '10000000-0000-0000-0000-00000000000a';
select tests.login_as('a0000000-0000-0000-0000-0000000000a0');
insert into tests.tap select throws_ok(
  $$select public.replace_working_hours('20000000-0000-0000-0000-0000000000a1', '[]'::jsonb)$$,
  'P0001', 'NOT_ALLOWED', 'permission: owner of a switched-off salon cannot change hours');

-- =============================================================================
-- 5. Slots follow the saved hours (end-to-end with migration 6)
-- =============================================================================
set local role postgres;
update public.businesses set is_active = true where id = '10000000-0000-0000-0000-00000000000a';
select tests.login_as('a0000000-0000-0000-0000-0000000000a0');
select public.replace_working_hours('20000000-0000-0000-0000-0000000000a1',
  jsonb_build_array(jsonb_build_object('weekday', tests.wd(3), 'start', '15:00', 'end', '16:00')));
select tests.login_as_anon();
insert into tests.tap select is(
  (select array_agg(to_char(s at time zone 'Asia/Tashkent', 'HH24:MI') order by s)
   from public.get_available_slots('10000000-0000-0000-0000-00000000000a',
     '30000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-0000000000a1', tests.day(3)) s),
  array['15:00', '15:15', '15:30'],
  'end-to-end: after saving 15:00–16:00, the booking page offers exactly 15:00, 15:15, 15:30');

select * from finish();
rollback;
