-- =============================================================================
-- 06 — Salon images (migration 9, M3.5 step 2a)
-- Storage rules on storage.objects, photo path columns, «Ishlarimiz» limit,
-- visitor visibility and the orphan finder.
-- Only database ROWS are created here (no real files). Rolled back at the end.
-- Run: npm run db:test -- 06
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

-- image paths used below (A = Salon A, B = Salon B)
create function tests.img(p_biz text, p_kind text, p_n int, p_size text default 'lg', p_ext text default 'webp')
returns text language sql immutable as $$
  select (case p_biz when 'A' then '10000000-0000-0000-0000-00000000000a' else '10000000-0000-0000-0000-00000000000b' end)
    || '/' || p_kind || '/' || lpad(p_n::text, 8, '0') || '-0000-4000-8000-000000000000/' || p_size || '.' || p_ext
$$;
grant execute on function tests.img(text, text, int, text, text) to anon, authenticated;
-- insert a storage row as the CURRENT role; true = allowed, false = refused by the rules
create function tests.put(p_name text) returns boolean language plpgsql as $$
begin
  insert into storage.objects (bucket_id, name) values ('salon-images', p_name);
  return true;
exception when insufficient_privilege then
  return false;
end $$;
grant execute on function tests.put(text) to anon, authenticated;

select no_plan();

-- =============================================================================
-- The bucket
-- =============================================================================
insert into tests.tap select results_eq(
  $$select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'salon-images'$$,
  $$values (true, 5242880::bigint, array['image/jpeg', 'image/png', 'image/webp'])$$,
  'bucket salon-images: public, 5 MB, only JPEG/PNG/WebP');

-- =============================================================================
-- OWNER A: uploads
-- =============================================================================
select tests.login_as('a0000000-0000-0000-0000-0000000000a0');

insert into tests.tap select ok(tests.put(tests.img('A', 'cover', 1)), 'Owner A: CAN upload a cover (lg)');
insert into tests.tap select ok(tests.put(tests.img('A', 'cover', 1, 'sm')), 'Owner A: CAN upload its small size (sm)');
insert into tests.tap select ok(tests.put(tests.img('A', 'logo', 2, 'lg', 'png')), 'Owner A: CAN upload a PNG logo');
insert into tests.tap select ok(tests.put(tests.img('A', 'staff', 3, 'lg', 'jpg')), 'Owner A: CAN upload a JPEG barber photo');
insert into tests.tap select ok(not tests.put(tests.img('B', 'cover', 4)), 'Owner A: cannot upload into Salon B folder');
insert into tests.tap select ok(not tests.put(tests.img('A', 'avatars', 5)), 'Owner A: unknown folder kind is refused');
insert into tests.tap select ok(not tests.put(tests.img('A', 'cover', 6, 'lg', 'heic')), 'Owner A: .heic name is refused (browser converts first)');
insert into tests.tap select ok(not tests.put(tests.img('A', 'cover', 7, 'big')), 'Owner A: unknown size name is refused');
insert into tests.tap select ok(not tests.put('10000000-0000-0000-0000-00000000000a/cover/photo.webp'), 'Owner A: a path without an image id is refused');
insert into tests.tap select ok(not tests.put('not-a-uuid/cover/00000001-0000-4000-8000-000000000000/lg.webp'), 'Owner A: a malformed salon folder is refused without an error');

with u as (update storage.objects set metadata = '{}' where bucket_id = 'salon-images' returning 1)
insert into tests.tap select is(count(*), 0::bigint, 'Owner A: cannot modify uploaded files (no UPDATE rule, 0 rows)') from u;

-- =============================================================================
-- STAFF (Jasur) and VISITORS cannot upload
-- =============================================================================
select tests.login_as('a0000000-0000-0000-0000-0000000000a1');
insert into tests.tap select ok(not tests.put(tests.img('A', 'gallery', 8)), 'Jasur (staff): cannot upload salon images');
insert into tests.tap select is(
  (select count(*) from storage.objects where bucket_id = 'salon-images'), 0::bigint,
  'Jasur (staff): cannot list the salon files');

select tests.login_as_anon();
insert into tests.tap select ok(not tests.put(tests.img('A', 'gallery', 9)), 'Visitor: cannot upload');

-- =============================================================================
-- OWNER B: cannot see or delete Salon A files
-- =============================================================================
select tests.login_as('b0000000-0000-0000-0000-0000000000b0');
select set_config('storage.allow_delete_query', 'true', true);   -- what the Storage API does
insert into tests.tap select is(
  (select count(*) from storage.objects where bucket_id = 'salon-images'), 0::bigint,
  'Owner B: does not see Salon A files');
with d as (delete from storage.objects where bucket_id = 'salon-images' returning 1)
insert into tests.tap select is(count(*), 0::bigint, 'Owner B: cannot delete Salon A files') from d;

-- =============================================================================
-- OWNER A: paths in the database
-- =============================================================================
select tests.login_as('a0000000-0000-0000-0000-0000000000a0');
insert into tests.tap select is(
  (select count(*) from storage.objects where bucket_id = 'salon-images'), 4::bigint,
  'Owner A: sees its own 4 files');

with u as (
  update public.businesses set cover_path = tests.img('A', 'cover', 1), logo_path = tests.img('A', 'logo', 2, 'lg', 'png')
  where id = '10000000-0000-0000-0000-00000000000a' returning 1
)
insert into tests.tap select is(count(*), 1::bigint, 'Owner A: CAN save cover + logo paths') from u;
insert into tests.tap select throws_ok(
  $$update public.businesses set cover_path = tests.img('B', 'cover', 1) where id = '10000000-0000-0000-0000-00000000000a'$$,
  '23514', null, 'Owner A: cannot point its cover at Salon B folder');
insert into tests.tap select throws_ok(
  $$update public.businesses set cover_path = tests.img('A', 'logo', 2) where id = '10000000-0000-0000-0000-00000000000a'$$,
  '23514', null, 'Owner A: a logo file cannot be used as the cover');
insert into tests.tap select throws_ok(
  $$update public.businesses set cover_path = tests.img('A', 'cover', 1, 'sm') where id = '10000000-0000-0000-0000-00000000000a'$$,
  '23514', null, 'Owner A: the database stores the lg file, never sm');

with u as (
  update public.staff set photo_path = tests.img('A', 'staff', 3, 'lg', 'jpg')
  where id = '20000000-0000-0000-0000-0000000000a1' returning 1
)
insert into tests.tap select is(count(*), 1::bigint, 'Owner A: CAN set Jasur photo') from u;
insert into tests.tap select throws_ok(
  $$update public.staff set photo_path = tests.img('A', 'cover', 1) where id = '20000000-0000-0000-0000-0000000000a1'$$,
  '23514', null, 'Owner A: a cover file cannot be a barber photo');
with u as (
  update public.staff set photo_path = null where id = '20000000-0000-0000-0000-0000000000a1' returning 1
)
insert into tests.tap select is(count(*), 1::bigint, 'Owner A: CAN remove Jasur photo (back to initials)') from u;

with u as (
  update public.services set photo_path = tests.img('A', 'services', 10)
  where id = '30000000-0000-0000-0000-0000000000a1' returning 1
)
insert into tests.tap select is(count(*), 1::bigint, 'Owner A: CAN set a service photo') from u;

-- =============================================================================
-- «Ishlarimiz»: max 12
-- =============================================================================
insert into tests.tap select lives_ok(
  $$insert into public.salon_photos (business_id, path)
    select '10000000-0000-0000-0000-00000000000a', tests.img('A', 'gallery', 100 + n) from generate_series(1, 12) n$$,
  'Owner A: CAN add 12 gallery photos');
insert into tests.tap select throws_ok(
  $$insert into public.salon_photos (business_id, path) values ('10000000-0000-0000-0000-00000000000a', tests.img('A', 'gallery', 113))$$,
  'P0001', 'GALLERY_FULL', 'Owner A: the 13th photo is refused (GALLERY_FULL)');
insert into tests.tap select throws_ok(
  $$insert into public.salon_photos (business_id, path) values ('10000000-0000-0000-0000-00000000000b', tests.img('B', 'gallery', 1))$$,
  '42501', null, 'Owner A: cannot add photos to Salon B');
with d as (delete from public.salon_photos where path = tests.img('A', 'gallery', 112) returning 1)
insert into tests.tap select is(count(*), 1::bigint, 'Owner A: CAN delete a gallery photo') from d;
insert into tests.tap select throws_ok(
  $$insert into public.salon_photos (business_id, path) values ('10000000-0000-0000-0000-00000000000a', tests.img('A', 'cover', 1))$$,
  '23514', null, 'Owner A: a cover file cannot be a gallery photo');
insert into tests.tap select throws_ok(
  $$update public.salon_photos set path = path$$,
  '42501', null, 'Owner A: gallery rows cannot be edited (delete + add instead)');

-- =============================================================================
-- STAFF + VISITORS: reading and changing
-- =============================================================================
select tests.login_as('a0000000-0000-0000-0000-0000000000a1');
with u as (
  update public.businesses set cover_path = null where id = '10000000-0000-0000-0000-00000000000a' returning 1
)
insert into tests.tap select is(count(*), 0::bigint, 'Jasur (staff): cannot change the salon cover (0 rows)') from u;
insert into tests.tap select throws_ok(
  $$insert into public.salon_photos (business_id, path) values ('10000000-0000-0000-0000-00000000000a', tests.img('A', 'gallery', 200))$$,
  '42501', null, 'Jasur (staff): cannot add gallery photos');

select tests.login_as_anon();
insert into tests.tap select is(
  (select count(*) from public.salon_photos where business_id = '10000000-0000-0000-0000-00000000000a'), 11::bigint,
  'Visitor: sees the 11 gallery photos of active Salon A');
insert into tests.tap select is(
  (select cover_path from public.businesses where id = '10000000-0000-0000-0000-00000000000a'),
  tests.img('A', 'cover', 1), 'Visitor: sees the cover path of an active salon');

-- =============================================================================
-- Orphan finder (server only)
-- =============================================================================
insert into tests.tap select throws_ok(
  $$select * from public.list_orphan_salon_images()$$,
  '42501', null, 'Visitor: cannot call the orphan finder');
select tests.login_as('a0000000-0000-0000-0000-0000000000a0');
insert into tests.tap select throws_ok(
  $$select * from public.list_orphan_salon_images()$$,
  '42501', null, 'Owner A: cannot call the orphan finder (server only)');

set local role postgres;
-- make every file "old", then add one fresh unreferenced upload (still in progress)
update storage.objects set created_at = now() - interval '2 days' where bucket_id = 'salon-images';
insert into storage.objects (bucket_id, name) values ('salon-images', tests.img('A', 'gallery', 300));
-- Referenced: cover lg+sm (1), logo (2). No longer referenced: barber photo 3 (removed above).
insert into tests.tap select results_eq(
  $$select name from public.list_orphan_salon_images() order by name$$,
  $$values (tests.img('A', 'staff', 3, 'lg', 'jpg'))$$,
  'orphan finder: only the removed barber photo (cover lg+sm and logo are in use; fresh upload skipped)');

-- =============================================================================
-- Inactive salon: owner can no longer upload, visitors see no photos
-- =============================================================================
update public.businesses set is_active = false where id = '10000000-0000-0000-0000-00000000000a';
select tests.login_as('a0000000-0000-0000-0000-0000000000a0');
insert into tests.tap select ok(not tests.put(tests.img('A', 'gallery', 400)), 'Owner of an INACTIVE salon: cannot upload');
select tests.login_as_anon();
insert into tests.tap select is(
  (select count(*) from public.salon_photos where business_id = '10000000-0000-0000-0000-00000000000a'), 0::bigint,
  'Visitor: sees no gallery photos of an inactive salon');

select * from finish();
rollback;
