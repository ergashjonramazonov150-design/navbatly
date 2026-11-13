-- =============================================================================
-- 05 — Salon settings (delivery 3c, Sozlamalar)
-- What an owner may change on the salon, what stays platform-admin only, and that
-- booking rules + salon-wide closed days really change the free slots.
-- Runs inside a transaction that is ROLLED BACK: nothing is left behind.
-- Run: npm run db:test -- 05
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

-- slots as local 'HH24:MI' text, for Jasur's 30-min haircut on day+3 (no bookings that day)
create function tests.jasur_slots() returns text[] language sql stable as $$
  select coalesce(array_agg(to_char(s at time zone 'Asia/Tashkent', 'HH24:MI') order by s), '{}')
  from public.get_available_slots('10000000-0000-0000-0000-00000000000a',
    '30000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-0000000000a1', tests.day(3)) s
$$;
grant execute on function tests.jasur_slots() to authenticated;

select no_plan();

-- =============================================================================
-- OWNER A: what the Sozlamalar form saves
-- =============================================================================
select tests.login_as('a0000000-0000-0000-0000-0000000000a0');

-- baseline: 15-min step, hours 09–13 + 14–19 → 09:00…12:30 (15) + 14:00…18:30 (19)
insert into tests.tap select is(cardinality(tests.jasur_slots()), 34,
  'baseline: 15-minute step gives 34 haircut slots');

with u as (
  update public.businesses
  set name = 'Salon A Yangi', phone = '+998901234567', address = 'Toshkent, 1-uy',
      slot_step_minutes = 30, booking_horizon_days = 60, min_notice_minutes = 120,
      max_active_bookings_per_phone = 5, auto_confirm = true
  where id = '10000000-0000-0000-0000-00000000000a'
  returning 1
)
insert into tests.tap select is(count(*), 1::bigint,
  'Owner A: CAN save salon details + booking rules in one update') from u;

insert into tests.tap select is(cardinality(tests.jasur_slots()), 18,
  'step 30 min → 18 slots (on :00 and :30 only)');
insert into tests.tap select ok(
  (select bool_and(right(x, 2) in ('00', '30')) from unnest(tests.jasur_slots()) x),
  'step 30 min → every slot starts on :00 or :30');

insert into tests.tap select lives_ok(
  $$update public.businesses set phone = null where id = '10000000-0000-0000-0000-00000000000a'$$,
  'Owner A: CAN clear the salon phone (it is optional)');
insert into tests.tap select throws_ok(
  $$update public.businesses set phone = '+99890123' where id = '10000000-0000-0000-0000-00000000000a'$$,
  '23514', null, 'Owner A: an incomplete phone is rejected');
insert into tests.tap select throws_ok(
  $$update public.businesses set slot_step_minutes = 25 where id = '10000000-0000-0000-0000-00000000000a'$$,
  '23514', null, 'Owner A: a time step outside 5/10/15/20/30/60 is rejected');
insert into tests.tap select throws_ok(
  $$update public.businesses set booking_horizon_days = 91 where id = '10000000-0000-0000-0000-00000000000a'$$,
  '23514', null, 'Owner A: booking horizon over 90 days is rejected');
insert into tests.tap select throws_ok(
  $$update public.businesses set name = 'A' where id = '10000000-0000-0000-0000-00000000000a'$$,
  '23514', null, 'Owner A: a 1-letter salon name is rejected');

-- platform-admin-only columns (read-only in the UI)
insert into tests.tap select throws_ok(
  $$update public.businesses set timezone = 'Europe/Moscow' where id = '10000000-0000-0000-0000-00000000000a'$$,
  '42501', null, 'Owner A: cannot change the timezone (platform admin only)');
insert into tests.tap select throws_ok(
  $$update public.businesses set is_active = false where id = '10000000-0000-0000-0000-00000000000a'$$,
  '42501', null, 'Owner A: cannot switch the salon off (platform admin only)');

with u as (
  update public.businesses set slot_step_minutes = 60 where id = '10000000-0000-0000-0000-00000000000b'
  returning 1
)
insert into tests.tap select is(count(*), 0::bigint,
  'Owner A: cannot change Salon B''s booking rules (0 rows updated)') from u;

-- =============================================================================
-- Salon-wide closed day (time_off with staff_id = NULL)
-- =============================================================================
insert into tests.tap select lives_ok(
  $$insert into public.time_off (business_id, staff_id, starts_at, ends_at, reason)
    values ('10000000-0000-0000-0000-00000000000a', null, tests.at(3, '00:00'), tests.at(4, '00:00'), 'Bayram')$$,
  'Owner A: CAN add a salon-wide closed day');
insert into tests.tap select is(cardinality(tests.jasur_slots()), 0,
  'salon closed on day+3 → no slots for any barber (Jasur: 0)');
insert into tests.tap select is(
  (select count(*) from public.get_available_slots('10000000-0000-0000-0000-00000000000a',
     '30000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-0000000000a2', tests.day(3))),
  0::bigint, 'salon closed on day+3 → Bobur: 0 slots too');

delete from public.time_off where business_id = '10000000-0000-0000-0000-00000000000a' and staff_id is null;
insert into tests.tap select is(cardinality(tests.jasur_slots()), 18,
  'closed day removed → slots come back (18 with the 30-min step)');

-- =============================================================================
-- STAFF (Jasur): Sozlamalar is owner-only, the database agrees
-- =============================================================================
select tests.login_as('a0000000-0000-0000-0000-0000000000a1');

with u as (
  update public.businesses set auto_confirm = false, slot_step_minutes = 15
  where id = '10000000-0000-0000-0000-00000000000a'
  returning 1
)
insert into tests.tap select is(count(*), 0::bigint,
  'Jasur: cannot change booking rules (0 rows updated)') from u;
insert into tests.tap select throws_ok(
  $$insert into public.time_off (business_id, staff_id, starts_at, ends_at)
    values ('10000000-0000-0000-0000-00000000000a', null, tests.at(5, '00:00'), tests.at(6, '00:00'))$$,
  '42501', null, 'Jasur: cannot close the whole salon');

select * from finish();
rollback;
