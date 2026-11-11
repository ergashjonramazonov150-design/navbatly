-- =============================================================================
-- 02 — Booking logic: slots, online booking, admin booking, spam limits
-- Runs inside a transaction that is ROLLED BACK: nothing is left behind.
-- Run: npm run db:test
--
-- Short names used in descriptions:
--   Salon A = 10000000-...-00000000000a     Salon B = 10000000-...-00000000000b
--   Jasur   = 20000000-...-0000000000a1     Bobur   = 20000000-...-0000000000a2
--   haircut = 30000000-...-0000000000a1 (30 min, 80 000)   beard = ...a2 (Bobur only)
--   Working hours (all staff, every day): 09:00–13:00 and 14:00–19:00
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

-- Call create_booking exactly like the Edge Function will (as service_role)
create function tests.book(
  p_staff uuid, p_starts timestamptz, p_phone text, p_ip text,
  p_service uuid default '30000000-0000-0000-0000-0000000000a1',
  p_business uuid default '10000000-0000-0000-0000-00000000000a',
  p_name text default 'Test Mijoz'
) returns jsonb language sql as $$
  select public.create_booking(p_business, p_service, p_staff, p_starts, p_name, p_phone, null, p_ip)
$$;
grant execute on function tests.book(uuid, timestamptz, text, text, uuid, uuid, text) to service_role;

select no_plan();

-- =============================================================================
-- 1. SLOT CALCULATION (as an anonymous visitor)
-- =============================================================================
select tests.login_as_anon();

insert into tests.tap select is(
  (select count(*) from public.get_available_slots('10000000-0000-0000-0000-00000000000a',
     '30000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-0000000000a1', tests.day(2))),
  34::bigint, 'slots: 34 on a free day (09:00–12:30 = 15, 14:00–18:30 = 19; 15-min grid)');

insert into tests.tap select is(
  (select min(s) from public.get_available_slots('10000000-0000-0000-0000-00000000000a',
     '30000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-0000000000a1', tests.day(2)) s),
  tests.at(2, '09:00'), 'slots: first slot = 09:00 (opening time)');

insert into tests.tap select is(
  (select max(s) from public.get_available_slots('10000000-0000-0000-0000-00000000000a',
     '30000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-0000000000a1', tests.day(2)) s),
  tests.at(2, '18:30'), 'slots: last slot = 18:30 (a 30-min service must END by 19:00)');

insert into tests.tap select is(
  (select (min(s) at time zone 'UTC')::time from public.get_available_slots('10000000-0000-0000-0000-00000000000a',
     '30000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-0000000000a1', tests.day(2)) s),
  time '04:00', 'timezone: 09:00 in Tashkent = 04:00 UTC');

insert into tests.tap select ok(
  tests.at(2, '12:30') in (select * from public.get_available_slots('10000000-0000-0000-0000-00000000000a',
     '30000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-0000000000a1', tests.day(2))),
  'lunch: 12:30 offered (ends exactly at 13:00)');

insert into tests.tap select ok(
  not exists (select 1 from public.get_available_slots('10000000-0000-0000-0000-00000000000a',
     '30000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-0000000000a1', tests.day(2)) s
     where s > tests.at(2, '12:30') and s < tests.at(2, '14:00')),
  'lunch: nothing between 12:30 and 14:00 (12:45 would run into lunch)');

insert into tests.tap select is_empty(
  $$select * from public.get_available_slots('10000000-0000-0000-0000-00000000000a',
     '30000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-0000000000a1', tests.day(-1))$$,
  'horizon: no slots for yesterday');
insert into tests.tap select isnt_empty(
  $$select * from public.get_available_slots('10000000-0000-0000-0000-00000000000a',
     '30000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-0000000000a1', tests.day(29))$$,
  'horizon: slots on today+29 (last day of a 30-day horizon)');
insert into tests.tap select is_empty(
  $$select * from public.get_available_slots('10000000-0000-0000-0000-00000000000a',
     '30000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-0000000000a1', tests.day(30))$$,
  'horizon: no slots on today+30');

insert into tests.tap select throws_ok(
  $$select * from public.get_available_slots('10000000-0000-0000-0000-00000000000a',
     '30000000-0000-0000-0000-0000000000a2', '20000000-0000-0000-0000-0000000000a1', tests.day(2))$$,
  'P0001', 'STAFF_SERVICE_MISMATCH', 'link: Jasur does not do beard → STAFF_SERVICE_MISMATCH');
insert into tests.tap select throws_ok(
  $$select * from public.get_available_slots('10000000-0000-0000-0000-00000000000a',
     '30000000-0000-0000-0000-0000000000a3', '20000000-0000-0000-0000-0000000000a1', tests.day(2))$$,
  'P0001', 'SERVICE_NOT_AVAILABLE', 'active flags: inactive service → SERVICE_NOT_AVAILABLE');
insert into tests.tap select throws_ok(
  $$select * from public.get_available_slots('10000000-0000-0000-0000-00000000000a',
     '30000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-0000000000a3', tests.day(2))$$,
  'P0001', 'STAFF_NOT_AVAILABLE', 'active flags: inactive staff → STAFF_NOT_AVAILABLE');
insert into tests.tap select throws_ok(
  $$select * from public.get_available_slots('10000000-0000-0000-0000-00000000000a',
     '30000000-0000-0000-0000-0000000000b1', '20000000-0000-0000-0000-0000000000a1', tests.day(2))$$,
  'P0001', 'SERVICE_NOT_AVAILABLE', 'tenant: Salon B''s service cannot be booked in Salon A');

-- min notice: with 24h notice, nothing is bookable today
set local role postgres;
update public.businesses set min_notice_minutes = 1440 where id = '10000000-0000-0000-0000-00000000000a';
select tests.login_as_anon();
insert into tests.tap select is_empty(
  $$select * from public.get_available_slots('10000000-0000-0000-0000-00000000000a',
     '30000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-0000000000a1', tests.day(0))$$,
  'min notice: 24h notice → no slots today');
set local role postgres;
update public.businesses set min_notice_minutes = 60 where id = '10000000-0000-0000-0000-00000000000a';

-- time off / closures / missing working hours
insert into public.time_off (business_id, staff_id, starts_at, ends_at) values
  ('10000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-0000000000a1', tests.at(3, '00:00'), tests.at(4, '00:00')),
  ('10000000-0000-0000-0000-00000000000a', null,                                   tests.at(4, '12:00'), tests.at(4, '15:00'));
delete from public.working_hours
where staff_id = '20000000-0000-0000-0000-0000000000a2' and weekday = extract(isodow from tests.day(5));

select tests.login_as_anon();
insert into tests.tap select is_empty(
  $$select * from public.get_available_slots('10000000-0000-0000-0000-00000000000a',
     '30000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-0000000000a1', tests.day(3))$$,
  'time off: no slots on Jasur''s day off');
insert into tests.tap select isnt_empty(
  $$select * from public.get_available_slots('10000000-0000-0000-0000-00000000000a',
     '30000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-0000000000a2', tests.day(3))$$,
  'time off: Bobur still has slots that day');
insert into tests.tap select ok(
  not exists (select 1 from public.get_available_slots('10000000-0000-0000-0000-00000000000a',
     '30000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-0000000000a2', tests.day(4)) s
     where s > tests.at(4, '11:30') and s < tests.at(4, '15:00')),
  'closure: whole-salon closure 12:00–15:00 removes overlapping slots for every barber');
insert into tests.tap select is_empty(
  $$select * from public.get_available_slots('10000000-0000-0000-0000-00000000000a',
     '30000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-0000000000a2', tests.day(5))$$,
  'working hours: no slots on a weekday without working hours');

-- =============================================================================
-- 2. ONLINE BOOKING (as service_role = the Edge Function)
-- =============================================================================
set local role service_role;

-- ⭐ requested: booking at exactly the end of working hours
insert into tests.tap select is(
  tests.book('20000000-0000-0000-0000-0000000000a1', tests.at(2, '18:30'), '+998900000001', 'iphash-endofday-0001')->>'ok',
  'true', 'end of day: 18:30 accepted (30-min service ends exactly at 19:00)');
insert into tests.tap select is(
  (select ends_at from public.appointments
   where staff_id = '20000000-0000-0000-0000-0000000000a1' and starts_at = tests.at(2, '18:30')),
  tests.at(2, '19:00'), 'end of day: ends_at = 19:00, computed by the database');
insert into tests.tap select is(
  tests.book('20000000-0000-0000-0000-0000000000a2', tests.at(2, '18:45'), '+998900000002', 'iphash-endofday-0001')->>'code',
  'SLOT_NOT_AVAILABLE', 'end of day: 18:45 rejected (would end 19:15, after closing)');
insert into tests.tap select is(
  tests.book('20000000-0000-0000-0000-0000000000a2', tests.at(2, '19:00'), '+998900000003', 'iphash-endofday-0001')->>'code',
  'SLOT_NOT_AVAILABLE', 'end of day: 19:00 rejected (salon closed)');
insert into tests.tap select is(
  tests.book('20000000-0000-0000-0000-0000000000a2', tests.at(2, '12:45'), '+998900000004', 'iphash-endofday-0001')->>'code',
  'SLOT_NOT_AVAILABLE', 'lunch: 12:45 rejected (would run into lunch)');

-- server decides price, end time, status, source
insert into tests.tap select is(
  tests.book('20000000-0000-0000-0000-0000000000a1', tests.at(2, '10:00'), '+998900000010', 'iphash-booking-00001')->>'ok',
  'true', 'booking: Jasur 10:00 accepted');
insert into tests.tap select results_eq(
  $$select status::text, source::text, price_uzs, ends_at from public.appointments
    where staff_id = '20000000-0000-0000-0000-0000000000a1' and starts_at = tests.at(2, '10:00')$$,
  $$values ('pending', 'online', 80000, tests.at(2, '10:30'))$$,
  'server decides: status=pending (auto_confirm off), source=online, price=80000, end=10:30');

insert into tests.tap select is(
  tests.book('20000000-0000-0000-0000-0000000000a1', tests.at(2, '10:30'), '+998900000011', 'iphash-booking-00001')->>'ok',
  'true', 'back-to-back: 10:30 accepted right after 10:00–10:30');
insert into tests.tap select is(
  tests.book('20000000-0000-0000-0000-0000000000a2', tests.at(2, '10:00'), '+998900000012', 'iphash-booking-00001')->>'ok',
  'true', 'same time, different barber (Bobur 10:00) accepted');
insert into tests.tap select is(
  tests.book('20000000-0000-0000-0000-0000000000a1', tests.at(2, '10:00'), '+998900000013', 'iphash-booking-00001')->>'code',
  'SLOT_TAKEN', 'same slot again → SLOT_TAKEN');
insert into tests.tap select is(
  tests.book('20000000-0000-0000-0000-0000000000a1', tests.at(2, '10:15'), '+998900000014', 'iphash-booking-00001')->>'code',
  'SLOT_TAKEN', 'partly overlapping start 10:15 → SLOT_TAKEN');
insert into tests.tap select is(
  tests.book('20000000-0000-0000-0000-0000000000a1', tests.at(2, '11:05'), '+998900000015', 'iphash-booking-00001')->>'code',
  'SLOT_NOT_AVAILABLE', 'off-grid time 11:05 → SLOT_NOT_AVAILABLE');
insert into tests.tap select is(
  tests.book('20000000-0000-0000-0000-0000000000a1', tests.at(3, '10:00'), '+998900000016', 'iphash-booking-00002')->>'code',
  'SLOT_NOT_AVAILABLE', 'time off: booking on Jasur''s day off → SLOT_NOT_AVAILABLE');
insert into tests.tap select is(
  tests.book('20000000-0000-0000-0000-0000000000a1', tests.at(2, '11:00'), '+998900000017', 'iphash-booking-00002',
             '30000000-0000-0000-0000-0000000000a2')->>'code',
  'STAFF_SERVICE_MISMATCH', 'link: booking beard with Jasur → STAFF_SERVICE_MISMATCH');

-- ⭐ requested: two simultaneous bookings of the same slot.
-- Inside ONE transaction we can't run two sessions in parallel, so here we prove
-- the database-level guarantee itself: even a direct INSERT that skips every
-- check is refused by the EXCLUDE constraint (23P01). The truly parallel test
-- (two separate connections at the same moment) is scripts/db-concurrency-test.mjs.
set local role postgres;
insert into tests.tap select throws_ok(
  $$insert into public.appointments (business_id, staff_id, service_id, starts_at, ends_at, source,
      customer_name, customer_phone, price_uzs)
    values ('10000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-0000000000a1',
      '30000000-0000-0000-0000-0000000000a1', tests.at(2, '10:10'), tests.at(2, '10:40'), 'admin',
      'Race', '+998900000099', 80000)$$,
  '23P01', null, 'no-overlap constraint: direct overlapping INSERT refused by the database (23P01)');

-- cancelling frees the slot
update public.appointments set status = 'cancelled'
where staff_id = '20000000-0000-0000-0000-0000000000a1' and starts_at = tests.at(2, '10:30');
set local role service_role;
insert into tests.tap select is(
  tests.book('20000000-0000-0000-0000-0000000000a1', tests.at(2, '10:30'), '+998900000018', 'iphash-booking-00002')->>'ok',
  'true', 'cancelled: the 10:30 slot is bookable again after cancellation');

-- auto_confirm = true → confirmed
set local role postgres;
update public.businesses set auto_confirm = true where id = '10000000-0000-0000-0000-00000000000b';
set local role service_role;
insert into tests.tap select is(
  tests.book('20000000-0000-0000-0000-0000000000b1', tests.at(2, '10:00'), '+998900000019', 'iphash-booking-00002',
             '30000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-00000000000b')->'appointment'->>'status',
  'confirmed', 'auto_confirm on (Salon B) → status confirmed');

-- input validation
insert into tests.tap select is(
  tests.book('20000000-0000-0000-0000-0000000000a1', tests.at(2, '11:00'), '901234567', 'iphash-input-000001')->>'code',
  'INVALID_PHONE', 'input: phone without +998 → INVALID_PHONE');
insert into tests.tap select is(
  tests.book('20000000-0000-0000-0000-0000000000a1', tests.at(2, '11:00'), '+998900000020', 'iphash-input-000001',
             p_name => 'A')->>'code',
  'INVALID_NAME', 'input: 1-letter name → INVALID_NAME');
insert into tests.tap select is(
  tests.book('20000000-0000-0000-0000-0000000000a1', tests.at(2, '11:00'), '+998900000021', 'iphash-input-000001',
             p_name => '   Ali    Valiyev  ')->>'ok',
  'true', 'input: name with extra spaces accepted');
insert into tests.tap select is(
  (select customer_name from public.appointments
   where staff_id = '20000000-0000-0000-0000-0000000000a1' and starts_at = tests.at(2, '11:00')),
  'Ali Valiyev', 'input: name is cleaned to "Ali Valiyev"');
insert into tests.tap select is(
  tests.book('20000000-0000-0000-0000-0000000000a1', tests.at(2, '11:30'), '+998900000022', 'short')->>'code',
  'INVALID_REQUEST', 'input: missing/short IP hash → INVALID_REQUEST');

-- =============================================================================
-- 3. SPAM LIMITS
-- =============================================================================
-- per phone: max 3 active future bookings per salon
insert into tests.tap select is(
  (select count(*) from (values
     (tests.book('20000000-0000-0000-0000-0000000000a1', tests.at(6, '09:00'), '+998977777777', 'iphash-phonelim-001')->>'ok'),
     (tests.book('20000000-0000-0000-0000-0000000000a1', tests.at(6, '09:30'), '+998977777777', 'iphash-phonelim-001')->>'ok'),
     (tests.book('20000000-0000-0000-0000-0000000000a1', tests.at(6, '10:00'), '+998977777777', 'iphash-phonelim-001')->>'ok')
   ) as v (ok) where ok = 'true'),
  3::bigint, 'phone limit: first 3 bookings with the same phone accepted');
insert into tests.tap select is(
  tests.book('20000000-0000-0000-0000-0000000000a1', tests.at(6, '10:30'), '+998977777777', 'iphash-phonelim-001')->>'code',
  'TOO_MANY_BOOKINGS', 'phone limit: 4th active booking → TOO_MANY_BOOKINGS');
insert into tests.tap select is(
  tests.book('20000000-0000-0000-0000-0000000000b1', tests.at(6, '10:30'), '+998977777777', 'iphash-phonelim-001',
             '30000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-00000000000b')->>'ok',
  'true', 'phone limit: is per salon — same phone can still book Salon B');
set local role postgres;
update public.appointments set status = 'cancelled'
where customer_phone = '+998977777777' and starts_at = tests.at(6, '09:00');
set local role service_role;
insert into tests.tap select is(
  tests.book('20000000-0000-0000-0000-0000000000a1', tests.at(6, '10:30'), '+998977777777', 'iphash-phonelim-001')->>'ok',
  'true', 'phone limit: cancelled bookings don''t count');

-- per IP: 10 attempts in 10 minutes
set local role postgres;
insert into private.booking_attempts (business_id, ip_hash)
select '10000000-0000-0000-0000-00000000000a', 'iphash-flood-000001' from generate_series(1, 10);
set local role service_role;
insert into tests.tap select is(
  tests.book('20000000-0000-0000-0000-0000000000a2', tests.at(7, '09:00'), '+998900000030', 'iphash-flood-000001')->>'code',
  'RATE_LIMITED', 'IP limit: 11th attempt within 10 minutes → RATE_LIMITED');

-- rejected attempts still count (the JSON-return design keeps the counter row)
select tests.book('20000000-0000-0000-0000-0000000000a2', tests.at(7, '09:00'), 'bad-phone', 'iphash-counted-00001');
set local role postgres;
insert into tests.tap select is(
  (select count(*) from private.booking_attempts where ip_hash = 'iphash-counted-00001'),
  1::bigint, 'IP limit: a REJECTED attempt is still counted');

-- =============================================================================
-- 4. ADMIN BOOKING
-- =============================================================================
select tests.login_as('a0000000-0000-0000-0000-0000000000a0'); -- owner A
insert into tests.tap select results_eq(
  $$select status::text, source::text from public.admin_create_appointment(
      '30000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-0000000000a1',
      tests.at(2, '20:00'), 'Walk-in', '+998901010101')$$,
  $$values ('confirmed', 'admin')$$,
  'admin: owner books 20:00 (after hours) → allowed, confirmed, source=admin');
insert into tests.tap select throws_ok(
  $$select public.admin_create_appointment('30000000-0000-0000-0000-0000000000a1',
      '20000000-0000-0000-0000-0000000000a1', tests.at(2, '10:00'), 'Overlap', '+998901010102')$$,
  'P0001', 'SLOT_TAKEN', 'admin: still cannot overlap an existing booking → SLOT_TAKEN');
insert into tests.tap select throws_ok(
  $$select public.admin_create_appointment('30000000-0000-0000-0000-0000000000a1',
      '20000000-0000-0000-0000-0000000000a1', tests.at(-3, '10:00'), 'Old', '+998901010103')$$,
  'P0001', 'INVALID_TIME', 'admin: more than 1 day in the past → INVALID_TIME');

select tests.login_as('a0000000-0000-0000-0000-0000000000a1'); -- Jasur
insert into tests.tap select lives_ok(
  $$select public.admin_create_appointment('30000000-0000-0000-0000-0000000000a1',
      '20000000-0000-0000-0000-0000000000a1', tests.at(2, '21:00'), 'Do''st', '+998901010104')$$,
  'admin: Jasur can book for himself');

-- =============================================================================
-- 5. WORKING HOURS RULE
-- =============================================================================
set local role postgres;
insert into tests.tap select throws_ok(
  $$insert into public.working_hours (business_id, staff_id, weekday, start_time, end_time)
    values ('10000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-0000000000a1', 1, '12:00', '15:00')$$,
  '23P01', null, 'working hours: overlapping interval (12:00–15:00 vs 09–13 / 14–19) refused');

select * from finish();
rollback;
