-- =============================================================================
-- 03 — Inactive barber / inactive salon: blocked by the DATABASE (migration 7)
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

-- Appointments: Jasur (A) 10:00, Bobur (A) 10:00, Akmal (B) 10:00 — all day+2
insert into public.appointments
  (id, business_id, staff_id, service_id, starts_at, ends_at, source, customer_name, customer_phone, price_uzs)
values
  ('40000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-00000000000a',
   '20000000-0000-0000-0000-0000000000a1', '30000000-0000-0000-0000-0000000000a1',
   tests.at(2, '10:00'), tests.at(2, '10:30'), 'online', 'Ali', '+998901234567', 80000),
  ('40000000-0000-0000-0000-0000000000a2', '10000000-0000-0000-0000-00000000000a',
   '20000000-0000-0000-0000-0000000000a2', '30000000-0000-0000-0000-0000000000a1',
   tests.at(2, '10:00'), tests.at(2, '10:30'), 'online', 'Vali', '+998907654321', 80000),
  ('40000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-00000000000b',
   '20000000-0000-0000-0000-0000000000b1', '30000000-0000-0000-0000-0000000000b1',
   tests.at(2, '10:00'), tests.at(2, '10:30'), 'online', 'Sardor', '+998901111111', 70000);

select no_plan();

-- =============================================================================
-- 1. Baseline: active Jasur sees his own appointment
-- =============================================================================
select tests.login_as('a0000000-0000-0000-0000-0000000000a1');
insert into tests.tap select is(
  (select count(*) from public.appointments), 1::bigint,
  'baseline: ACTIVE Jasur sees his 1 appointment');

-- =============================================================================
-- 2. Jasur's staff profile switched OFF → database refuses everything
-- =============================================================================
set local role postgres;
update public.staff set is_active = false where id = '20000000-0000-0000-0000-0000000000a1';
select tests.login_as('a0000000-0000-0000-0000-0000000000a1');

insert into tests.tap select is(
  (select count(*) from public.appointments), 0::bigint,
  'inactive Jasur: reads 0 appointments');
insert into tests.tap select is(
  (select count(*) from public.working_hours), 0::bigint,
  'inactive Jasur: reads 0 working hours');
insert into tests.tap select is(
  (select count(*) from public.time_off), 0::bigint,
  'inactive Jasur: reads 0 time off rows');
insert into tests.tap select is(
  (select count(*) from public.staff where is_active = false), 1::bigint,
  'inactive Jasur: can still see his OWN staff profile (app needs it for the message)');
insert into tests.tap select is(
  (select count(*) from public.business_members), 1::bigint,
  'inactive Jasur: can still see his own membership row');
insert into tests.tap select throws_ok(
  $$select public.set_appointment_status('40000000-0000-0000-0000-0000000000a1', 'confirmed')$$,
  'P0001', 'APPOINTMENT_NOT_FOUND',
  'inactive Jasur: cannot confirm his appointment');
insert into tests.tap select throws_ok(
  $$select public.admin_create_appointment('30000000-0000-0000-0000-0000000000a1',
      '20000000-0000-0000-0000-0000000000a1', tests.at(3, '10:00'), 'Test', '+998901234567')$$,
  'P0001', 'NOT_ALLOWED',
  'inactive Jasur: cannot create a booking for himself');

-- Owner A is not affected by Jasur being inactive
select tests.login_as('a0000000-0000-0000-0000-0000000000a0');
insert into tests.tap select is(
  (select count(*) from public.appointments), 2::bigint,
  'owner A: still sees both Salon A appointments (incl. inactive Jasur''s)');
insert into tests.tap select ok(
  (select count(*) from public.working_hours) > 0,
  'owner A: still sees working hours');

-- Bobur (active, same salon) is not affected
select tests.login_as('a0000000-0000-0000-0000-0000000000a2');
insert into tests.tap select is(
  (select count(*) from public.appointments), 1::bigint,
  'Bobur (active): still sees his own appointment');

-- Reactivating restores access
set local role postgres;
update public.staff set is_active = true where id = '20000000-0000-0000-0000-0000000000a1';
select tests.login_as('a0000000-0000-0000-0000-0000000000a1');
insert into tests.tap select is(
  (select count(*) from public.appointments), 1::bigint,
  'reactivated Jasur: sees his appointment again');

-- =============================================================================
-- 3. Whole salon A switched OFF by the platform admin
-- =============================================================================
set local role postgres;
update public.businesses set is_active = false where id = '10000000-0000-0000-0000-00000000000a';

select tests.login_as('a0000000-0000-0000-0000-0000000000a0'); -- owner A
insert into tests.tap select is(
  (select count(*) from public.appointments), 0::bigint,
  'inactive salon: owner reads 0 appointments');
insert into tests.tap select is(
  (select count(*) from public.business_telegram_settings), 0::bigint,
  'inactive salon: owner reads 0 telegram settings');
insert into tests.tap select is(
  (select count(*) from public.businesses where id = '10000000-0000-0000-0000-00000000000a' and not is_active),
  1::bigint,
  'inactive salon: owner can still see the salon row (app shows the message)');
with u as (
  update public.businesses set name = 'Still mine?' where id = '10000000-0000-0000-0000-00000000000a'
  returning 1
)
insert into tests.tap select is(count(*), 0::bigint, 'inactive salon: owner cannot edit it') from u;
insert into tests.tap select throws_ok(
  $$insert into public.services (business_id, name, duration_minutes, price_uzs)
    values ('10000000-0000-0000-0000-00000000000a', 'New', 30, 1000)$$,
  '42501', null, 'inactive salon: owner cannot add services');
insert into tests.tap select throws_ok(
  $$select public.set_appointment_status('40000000-0000-0000-0000-0000000000a2', 'cancelled')$$,
  'P0001', 'APPOINTMENT_NOT_FOUND', 'inactive salon: owner cannot change bookings');

select tests.login_as('a0000000-0000-0000-0000-0000000000a1'); -- Jasur (active profile)
insert into tests.tap select is(
  (select count(*) from public.appointments), 0::bigint,
  'inactive salon: its staff read 0 appointments');

select tests.login_as_anon();
insert into tests.tap select is(
  (select count(*) from public.businesses where id = '10000000-0000-0000-0000-00000000000a'),
  0::bigint, 'inactive salon: hidden from the public');

-- Salon B is unaffected
select tests.login_as('b0000000-0000-0000-0000-0000000000b0');
insert into tests.tap select is(
  (select count(*) from public.appointments), 1::bigint,
  'other salon (B): owner unaffected');

select * from finish();
rollback;
