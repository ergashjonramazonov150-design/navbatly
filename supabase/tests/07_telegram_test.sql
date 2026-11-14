-- =============================================================================
-- 07 — Telegram linking (migration 10, M6): link codes, webhook linking, who may do what.
-- Run: npm run db:test -- 07
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

-- pretend to be the server (Edge Function with the secret key)
create function tests.login_as_server() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  perform set_config('role', 'service_role', true);
end $$;
grant execute on function tests.login_as_server() to anon, authenticated, service_role;

select no_plan();

-- fixture rows exist for A and B (chat ids 111111 / 222222). Start Salon A unlinked.
update public.business_telegram_settings
set chat_id = null, is_enabled = false where business_id = '10000000-0000-0000-0000-00000000000a';

-- =============================================================================
-- OWNER A: makes a link code; cannot set a chat id himself
-- =============================================================================
select tests.login_as('a0000000-0000-0000-0000-0000000000a0');

insert into tests.tap select ok(
  (select public.telegram_create_link_code('10000000-0000-0000-0000-00000000000a', 'codeA1_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'))
    between now() + interval '9 minutes' and now() + interval '11 minutes',
  'Owner A: CAN create a link code (valid 10 minutes)');
insert into tests.tap select throws_ok(
  $$select public.telegram_create_link_code('10000000-0000-0000-0000-00000000000b', 'codeB1_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')$$,
  'P0001', 'NOT_ALLOWED', 'Owner A: cannot create a code for Salon B');
insert into tests.tap select throws_ok(
  $$select public.telegram_create_link_code('10000000-0000-0000-0000-00000000000a', 'short')$$,
  'P0001', 'INVALID_REQUEST', 'Owner A: a short/guessable code is refused');
insert into tests.tap select throws_ok(
  $$update public.business_telegram_settings set chat_id = '999' where business_id = '10000000-0000-0000-0000-00000000000a'$$,
  '42501', null, 'Owner A: cannot type a chat id (only the webhook links)');
insert into tests.tap select throws_ok(
  $$insert into public.business_telegram_settings (business_id, chat_id) values ('10000000-0000-0000-0000-00000000000a', '999')$$,
  '42501', null, 'Owner A: cannot create the settings row himself');
insert into tests.tap select throws_ok(
  $$select public.telegram_link_chat('codeA1_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', '555', 'Hacker')$$,
  '42501', null, 'Owner A: cannot call the webhook function');

-- =============================================================================
-- STAFF + VISITORS
-- =============================================================================
select tests.login_as('a0000000-0000-0000-0000-0000000000a1');
insert into tests.tap select throws_ok(
  $$select public.telegram_create_link_code('10000000-0000-0000-0000-00000000000a', 'codeJ1_jjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjj')$$,
  'P0001', 'NOT_ALLOWED', 'Jasur (staff): cannot link the salon bot');
insert into tests.tap select is(
  (select count(*) from public.business_telegram_settings), 0::bigint,
  'Jasur (staff): cannot see Telegram settings');
select tests.login_as_anon();
insert into tests.tap select throws_ok(
  $$select public.telegram_create_link_code('10000000-0000-0000-0000-00000000000a', 'codeX1_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx')$$,
  '42501', null, 'Visitor: cannot create codes');

-- =============================================================================
-- SERVER (webhook): /start <code>
-- =============================================================================
select tests.login_as_server();
insert into tests.tap select is(
  public.telegram_link_chat('wrong_code_zzzzzzzzzzzzzzzzzzzzzzzzzzzz', '555', 'X'), null,
  'webhook: unknown code → not linked');
insert into tests.tap select is(
  public.telegram_link_chat('codeA1_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', '777000111', 'Salon egasi'), 'Test Salon A',
  'webhook: valid code → linked, returns the salon name');
insert into tests.tap select results_eq(
  $$select chat_id, chat_title, is_enabled, linked_at is not null from public.business_telegram_settings where business_id = '10000000-0000-0000-0000-00000000000a'$$,
  $$values ('777000111'::text, 'Salon egasi'::text, true, true)$$,
  'webhook: chat saved, notifications on');
insert into tests.tap select is(
  public.telegram_link_chat('codeA1_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', '555', 'Second try'), null,
  'webhook: a code works only once');

-- expired code
set local role postgres;
insert into private.telegram_link_codes (code_hash, business_id, created_by, expires_at)
values (encode(sha256(convert_to('codeOld_ooooooooooooooooooooooooooooooo', 'UTF8')), 'hex'),
        '10000000-0000-0000-0000-00000000000b', 'b0000000-0000-0000-0000-0000000000b0', now() - interval '1 minute');
select tests.login_as_server();
insert into tests.tap select is(
  public.telegram_link_chat('codeOld_ooooooooooooooooooooooooooooooo', '555', 'X'), null,
  'webhook: an expired code is refused');

-- =============================================================================
-- OWNER A: switch off/on, unlink; cannot touch Salon B
-- =============================================================================
select tests.login_as('a0000000-0000-0000-0000-0000000000a0');
with u as (update public.business_telegram_settings set is_enabled = false where business_id = '10000000-0000-0000-0000-00000000000a' returning 1)
insert into tests.tap select is(count(*), 1::bigint, 'Owner A: CAN switch notifications off') from u;
insert into tests.tap select throws_ok(
  $$select public.telegram_unlink('10000000-0000-0000-0000-00000000000b')$$,
  'P0001', 'NOT_ALLOWED', 'Owner A: cannot unlink Salon B');
insert into tests.tap select lives_ok(
  $$select public.telegram_unlink('10000000-0000-0000-0000-00000000000a')$$, 'Owner A: CAN "Uzish"');
insert into tests.tap select results_eq(
  $$select chat_id is null, is_enabled, linked_at is null from public.business_telegram_settings where business_id = '10000000-0000-0000-0000-00000000000a'$$,
  $$values (true, false, true)$$,
  'after "Uzish": no chat, off');

select * from finish();
rollback;
