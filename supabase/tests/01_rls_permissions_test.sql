-- =============================================================================
-- 01 — RLS & permissions
-- Who can see / change what: anon, staff, owner, other business.
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

-- Appointments for this file: Jasur (A), Bobur (A), Akmal (B), all day+2 10:00
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
-- ANON (public visitor)
-- =============================================================================
select tests.login_as_anon();

insert into tests.tap select is(
  (select count(*) from public.businesses
   where id in ('10000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000b')),
  2::bigint, 'anon: sees active businesses');

insert into tests.tap select is(
  (select count(*) from public.staff where business_id = '10000000-0000-0000-0000-00000000000a'),
  2::bigint, 'anon: sees only ACTIVE staff (inactive one hidden)');

insert into tests.tap select is(
  (select count(*) from public.services where business_id = '10000000-0000-0000-0000-00000000000a'),
  2::bigint, 'anon: sees only ACTIVE services');

insert into tests.tap select throws_ok('select * from public.appointments', '42501', null,
  'anon: cannot read appointments at all');
insert into tests.tap select throws_ok('select * from public.working_hours', '42501', null,
  'anon: cannot read working_hours (slots come from a function)');
insert into tests.tap select throws_ok('select * from public.business_members', '42501', null,
  'anon: cannot read business_members');
insert into tests.tap select throws_ok('select * from public.business_telegram_settings', '42501', null,
  'anon: cannot read telegram settings');
insert into tests.tap select throws_ok(
  $$insert into public.services (business_id, name, duration_minutes, price_uzs)
    values ('10000000-0000-0000-0000-00000000000a', 'Hack', 30, 1)$$,
  '42501', null, 'anon: cannot insert services');
insert into tests.tap select throws_ok(
  $$select public.create_booking('10000000-0000-0000-0000-00000000000a',
      '30000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-0000000000a1',
      now(), 'Bot', '+998900000000', null, 'iphash-0000000000000001')$$,
  '42501', null, 'anon: cannot call create_booking directly (Edge Function only)');
insert into tests.tap select throws_ok(
  $$select public.set_appointment_status('40000000-0000-0000-0000-0000000000a1', 'cancelled')$$,
  '42501', null, 'anon: cannot call set_appointment_status');
insert into tests.tap select isnt_empty(
  $$select * from public.get_available_slots('10000000-0000-0000-0000-00000000000a',
      '30000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-0000000000a1', tests.day(3))$$,
  'anon: CAN call get_available_slots');

-- =============================================================================
-- STAFF: Jasur (Salon A)
-- =============================================================================
select tests.login_as('a0000000-0000-0000-0000-0000000000a1');

insert into tests.tap select results_eq(
  'select id from public.appointments',
  $$values ('40000000-0000-0000-0000-0000000000a1'::uuid)$$,
  'Jasur: sees ONLY his own appointment (not Bobur''s, not Salon B''s)');

insert into tests.tap select is(
  (select count(*) from public.business_members), 1::bigint,
  'Jasur: sees only his own membership row');

insert into tests.tap select ok(
  (select count(*) from public.working_hours where business_id = '10000000-0000-0000-0000-00000000000a') > 0,
  'Jasur: can read his salon''s working hours');
insert into tests.tap select is(
  (select count(*) from public.working_hours where business_id = '10000000-0000-0000-0000-00000000000b'),
  0::bigint, 'Jasur: cannot read Salon B''s working hours');
insert into tests.tap select is(
  (select count(*) from public.business_telegram_settings), 0::bigint,
  'Jasur: cannot read telegram settings (owners only)');

-- ⭐ requested: staff trying to change ANOTHER barber's appointment
insert into tests.tap select throws_ok(
  $$select public.set_appointment_status('40000000-0000-0000-0000-0000000000a2', 'cancelled')$$,
  'P0001', 'APPOINTMENT_NOT_FOUND',
  'Jasur: CANNOT cancel Bobur''s appointment (same salon, other barber)');
insert into tests.tap select throws_ok(
  $$select public.set_appointment_status('40000000-0000-0000-0000-0000000000b1', 'cancelled')$$,
  'P0001', 'APPOINTMENT_NOT_FOUND',
  'Jasur: CANNOT cancel an appointment in Salon B');
insert into tests.tap select throws_ok(
  $$update public.appointments set status = 'cancelled'
    where id = '40000000-0000-0000-0000-0000000000a2'$$,
  '42501', null, 'Jasur: cannot bypass the function with a direct UPDATE');
insert into tests.tap select throws_ok(
  $$select public.admin_create_appointment('30000000-0000-0000-0000-0000000000a1',
      '20000000-0000-0000-0000-0000000000a2', tests.at(5, '10:00'), 'Test', '+998901234567')$$,
  'P0001', 'NOT_ALLOWED', 'Jasur: cannot create a booking for Bobur');

insert into tests.tap select is(
  (select (public.set_appointment_status('40000000-0000-0000-0000-0000000000a1', 'confirmed')).status),
  'confirmed'::public.appointment_status,
  'Jasur: CAN confirm his own appointment');

insert into tests.tap select throws_ok(
  $$insert into public.services (business_id, name, duration_minutes, price_uzs)
    values ('10000000-0000-0000-0000-00000000000a', 'Staff svc', 30, 1)$$,
  '42501', null, 'Jasur: cannot add services (owner only)');

with u as (
  update public.businesses set name = 'Hacked' where id = '10000000-0000-0000-0000-00000000000a'
  returning 1
)
insert into tests.tap select is(count(*), 0::bigint, 'Jasur: cannot rename the salon (0 rows updated)') from u;

-- =============================================================================
-- OWNER: Salon A
-- =============================================================================
select tests.login_as('a0000000-0000-0000-0000-0000000000a0');

insert into tests.tap select is(
  (select count(*) from public.appointments), 2::bigint,
  'Owner A: sees all appointments of Salon A, none of Salon B');
insert into tests.tap select is(
  (select count(*) from public.business_members), 3::bigint,
  'Owner A: sees all 3 members of Salon A');
insert into tests.tap select results_eq(
  'select business_id from public.business_telegram_settings',
  $$values ('10000000-0000-0000-0000-00000000000a'::uuid)$$,
  'Owner A: sees only Salon A telegram settings');

insert into tests.tap select is(
  (select (public.set_appointment_status('40000000-0000-0000-0000-0000000000a2', 'cancelled', 'Mijoz qo''ng''iroq qildi')).status),
  'cancelled'::public.appointment_status,
  'Owner A: CAN cancel Bobur''s appointment');
insert into tests.tap select is(
  (select status_changed_by from public.appointments where id = '40000000-0000-0000-0000-0000000000a2'),
  'a0000000-0000-0000-0000-0000000000a0'::uuid,
  'Owner A: status change records WHO did it');
insert into tests.tap select throws_ok(
  $$select public.set_appointment_status('40000000-0000-0000-0000-0000000000a2', 'confirmed')$$,
  'P0001', 'INVALID_STATUS_TRANSITION',
  'Owner A: cannot re-activate a cancelled appointment');
insert into tests.tap select throws_ok(
  $$select public.set_appointment_status('40000000-0000-0000-0000-0000000000b1', 'cancelled')$$,
  'P0001', 'APPOINTMENT_NOT_FOUND',
  'Owner A: cannot touch Salon B''s appointment');

with u as (
  update public.businesses set name = 'Salon A Renamed' where id = '10000000-0000-0000-0000-00000000000a'
  returning 1
)
insert into tests.tap select is(count(*), 1::bigint, 'Owner A: CAN rename own salon') from u;
insert into tests.tap select throws_ok(
  $$update public.businesses set slug = 'stolen-slug' where id = '10000000-0000-0000-0000-00000000000a'$$,
  '42501', null, 'Owner A: cannot change slug (platform admin only)');
with u as (
  update public.businesses set name = 'Hacked B' where id = '10000000-0000-0000-0000-00000000000b'
  returning 1
)
insert into tests.tap select is(count(*), 0::bigint, 'Owner A: cannot rename Salon B') from u;

insert into tests.tap select lives_ok(
  $$insert into public.services (business_id, name, duration_minutes, price_uzs)
    values ('10000000-0000-0000-0000-00000000000a', 'Yangi xizmat', 45, 100000)$$,
  'Owner A: CAN add a service to own salon');
insert into tests.tap select throws_ok(
  $$insert into public.services (business_id, name, duration_minutes, price_uzs)
    values ('10000000-0000-0000-0000-00000000000b', 'Sneaky', 30, 1)$$,
  '42501', null, 'Owner A: cannot add a service to Salon B');
insert into tests.tap select throws_ok(
  $$delete from public.appointments where id = '40000000-0000-0000-0000-0000000000a1'$$,
  '42501', null, 'Owner A: cannot delete appointments (cancel instead)');
insert into tests.tap select throws_ok(
  $$delete from public.services where id = '30000000-0000-0000-0000-0000000000a2'$$,
  '42501', null, 'Owner A: cannot delete services (deactivate instead)');

-- =============================================================================
-- OWNER: Salon B
-- =============================================================================
select tests.login_as('b0000000-0000-0000-0000-0000000000b0');

insert into tests.tap select results_eq(
  'select id from public.appointments',
  $$values ('40000000-0000-0000-0000-0000000000b1'::uuid)$$,
  'Owner B: sees only Salon B''s appointment');
insert into tests.tap select is(
  (select count(*) from public.working_hours where business_id = '10000000-0000-0000-0000-00000000000a'),
  0::bigint, 'Owner B: cannot read Salon A''s working hours');

set local role postgres;
select * from finish();
rollback;
