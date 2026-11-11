-- =============================================================================
-- Demo data for the DEV project: "Navbatly Demo Barbershop" (/b/demo)
--
-- Run with:  npm run db:seed
-- The runner (scripts/db-seed.mjs) replaces __OWNER_EMAIL__ / __BARBER_EMAIL__
-- with SEED_OWNER_EMAIL / SEED_BARBER_EMAIL from .env.local, so real email
-- addresses never end up in git.
--
-- Safe to re-run: the demo salon is deleted and recreated each time.
-- Everything runs as ONE transaction: if any check fails, nothing is saved.
--
-- ALL customer data below is FAKE: names say "Test mijoz", phone numbers are
-- the obviously fake series +998 90 000 00 0X.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Both login users must already exist (created in the Supabase dashboard)
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from auth.users where lower(email) = lower('__OWNER_EMAIL__')) then
    raise exception 'SEED STOPPED: owner user not found in this project (create it in Authentication → Users)';
  end if;
  if not exists (select 1 from auth.users where lower(email) = lower('__BARBER_EMAIL__')) then
    raise exception 'SEED STOPPED: barber user not found in this project (create it in Authentication → Users)';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 1. Start clean (cascades to staff, services, hours, members, appointments...)
-- -----------------------------------------------------------------------------
delete from public.businesses where id = 'd0000000-0000-0000-0000-000000000001';

-- -----------------------------------------------------------------------------
-- 2. Salon
-- -----------------------------------------------------------------------------
insert into public.businesses (
  id, name, slug, phone, address,
  slot_step_minutes, booking_horizon_days, min_notice_minutes,
  max_active_bookings_per_phone, auto_confirm
) values (
  'd0000000-0000-0000-0000-000000000001',
  'Navbatly Demo Barbershop',
  'demo',
  '+998900000000',                          -- fake demo number
  'Toshkent sh., Namuna ko''chasi, 1-uy (demo manzil)',
  15, 30, 60,
  3,
  false                                     -- owner confirms bookings manually
);

-- -----------------------------------------------------------------------------
-- 3. Barbers (Jasur is linked to the barber login below)
-- -----------------------------------------------------------------------------
insert into public.staff (id, business_id, full_name, bio, sort_order) values
  ('d0000000-0000-0000-0000-0000000000a1', 'd0000000-0000-0000-0000-000000000001',
   'Jasur', 'Klassik va zamonaviy soch turmaklari. 8 yillik tajriba.', 1),
  ('d0000000-0000-0000-0000-0000000000a2', 'd0000000-0000-0000-0000-000000000001',
   'Bobur', 'Soqol va fade bo''yicha mutaxassis.', 2),
  ('d0000000-0000-0000-0000-0000000000a3', 'd0000000-0000-0000-0000-000000000001',
   'Akmal', 'Bolalar soch turmaklari va ukladka.', 3);

-- -----------------------------------------------------------------------------
-- 4. Services
-- SAMPLE PRICES — illustrative values for the demo only, not real market data.
-- -----------------------------------------------------------------------------
insert into public.services (id, business_id, name, description, duration_minutes, price_uzs, sort_order) values
  ('d0000000-0000-0000-0000-0000000000b1', 'd0000000-0000-0000-0000-000000000001',
   'Soch olish', 'Yuvish va ukladka bilan', 30, 80000, 1),           -- sample price
  ('d0000000-0000-0000-0000-0000000000b2', 'd0000000-0000-0000-0000-000000000001',
   'Soqol olish', 'Shakl berish va issiq sochiq', 20, 50000, 2),      -- sample price
  ('d0000000-0000-0000-0000-0000000000b3', 'd0000000-0000-0000-0000-000000000001',
   'Soch + soqol', 'Kompleks xizmat', 50, 120000, 3),                -- sample price
  ('d0000000-0000-0000-0000-0000000000b4', 'd0000000-0000-0000-0000-000000000001',
   'Bolalar soch turmagi', '12 yoshgacha', 30, 60000, 4),             -- sample price
  ('d0000000-0000-0000-0000-0000000000b5', 'd0000000-0000-0000-0000-000000000001',
   'Ukladka', 'Bayram yoki tadbir uchun', 20, 40000, 5);              -- sample price

-- -----------------------------------------------------------------------------
-- 5. Who does what
--   Jasur: everything · Bobur: haircut, beard, combo · Akmal: haircut, kids, styling
-- -----------------------------------------------------------------------------
insert into public.staff_services (business_id, staff_id, service_id)
select 'd0000000-0000-0000-0000-000000000001', s.staff_id::uuid, s.service_id::uuid
from (values
  ('d0000000-0000-0000-0000-0000000000a1', 'd0000000-0000-0000-0000-0000000000b1'),
  ('d0000000-0000-0000-0000-0000000000a1', 'd0000000-0000-0000-0000-0000000000b2'),
  ('d0000000-0000-0000-0000-0000000000a1', 'd0000000-0000-0000-0000-0000000000b3'),
  ('d0000000-0000-0000-0000-0000000000a1', 'd0000000-0000-0000-0000-0000000000b4'),
  ('d0000000-0000-0000-0000-0000000000a1', 'd0000000-0000-0000-0000-0000000000b5'),
  ('d0000000-0000-0000-0000-0000000000a2', 'd0000000-0000-0000-0000-0000000000b1'),
  ('d0000000-0000-0000-0000-0000000000a2', 'd0000000-0000-0000-0000-0000000000b2'),
  ('d0000000-0000-0000-0000-0000000000a2', 'd0000000-0000-0000-0000-0000000000b3'),
  ('d0000000-0000-0000-0000-0000000000a3', 'd0000000-0000-0000-0000-0000000000b1'),
  ('d0000000-0000-0000-0000-0000000000a3', 'd0000000-0000-0000-0000-0000000000b4'),
  ('d0000000-0000-0000-0000-0000000000a3', 'd0000000-0000-0000-0000-0000000000b5')
) as s (staff_id, service_id);

-- -----------------------------------------------------------------------------
-- 6. Working hours: Mon–Sat 09:00–13:00 and 14:00–20:00, Sunday off
-- -----------------------------------------------------------------------------
insert into public.working_hours (business_id, staff_id, weekday, start_time, end_time)
select st.business_id, st.id, d, w.start_time, w.end_time
from public.staff st
cross join generate_series(1, 6) as d
cross join (values (time '09:00', time '13:00'), (time '14:00', time '20:00')) as w (start_time, end_time)
where st.business_id = 'd0000000-0000-0000-0000-000000000001';

-- -----------------------------------------------------------------------------
-- 7. Logins: owner + barber (linked to Jasur's staff profile)
-- -----------------------------------------------------------------------------
insert into public.business_members (business_id, user_id, role, staff_id)
select 'd0000000-0000-0000-0000-000000000001', u.id, 'owner', null
from auth.users u where lower(u.email) = lower('__OWNER_EMAIL__');

insert into public.business_members (business_id, user_id, role, staff_id)
select 'd0000000-0000-0000-0000-000000000001', u.id, 'staff', 'd0000000-0000-0000-0000-0000000000a1'
from auth.users u where lower(u.email) = lower('__BARBER_EMAIL__');

-- -----------------------------------------------------------------------------
-- 8. Telegram: off until M6
-- -----------------------------------------------------------------------------
insert into public.business_telegram_settings (business_id, chat_id, is_enabled)
values ('d0000000-0000-0000-0000-000000000001', null, false);

-- -----------------------------------------------------------------------------
-- 9. Sample appointments on the next 3 working days (Sundays skipped).
-- FAKE customers only: "Test mijoz N", phones +998900000001 … +998900000008.
-- -----------------------------------------------------------------------------
with days as (
  select d, row_number() over (order by d) as n
  from generate_series(
    (now() at time zone 'Asia/Tashkent')::date + 1,
    (now() at time zone 'Asia/Tashkent')::date + 7,
    interval '1 day'
  ) as g (d)
  where extract(isodow from g.d) <> 7
),
samples (day_n, at_time, staff_id, service_id, status, source, customer_name, customer_phone) as (
  values
    (1, time '10:00', 'd0000000-0000-0000-0000-0000000000a1', 'd0000000-0000-0000-0000-0000000000b1', 'pending',   'online', 'Test mijoz 1', '+998900000001'),
    (1, time '11:00', 'd0000000-0000-0000-0000-0000000000a1', 'd0000000-0000-0000-0000-0000000000b3', 'confirmed', 'online', 'Test mijoz 2', '+998900000002'),
    (1, time '15:00', 'd0000000-0000-0000-0000-0000000000a2', 'd0000000-0000-0000-0000-0000000000b2', 'confirmed', 'admin',  'Test mijoz 3', '+998900000003'),
    (2, time '09:30', 'd0000000-0000-0000-0000-0000000000a3', 'd0000000-0000-0000-0000-0000000000b4', 'pending',   'online', 'Test mijoz 4', '+998900000004'),
    (2, time '14:00', 'd0000000-0000-0000-0000-0000000000a1', 'd0000000-0000-0000-0000-0000000000b1', 'cancelled', 'online', 'Test mijoz 5', '+998900000005'),
    (2, time '16:30', 'd0000000-0000-0000-0000-0000000000a2', 'd0000000-0000-0000-0000-0000000000b1', 'pending',   'online', 'Test mijoz 6', '+998900000006'),
    (3, time '12:00', 'd0000000-0000-0000-0000-0000000000a1', 'd0000000-0000-0000-0000-0000000000b5', 'confirmed', 'online', 'Test mijoz 7', '+998900000007'),
    (3, time '18:00', 'd0000000-0000-0000-0000-0000000000a3', 'd0000000-0000-0000-0000-0000000000b1', 'pending',   'online', 'Test mijoz 8', '+998900000008')
)
insert into public.appointments (
  business_id, staff_id, service_id, starts_at, ends_at, status, source,
  customer_name, customer_phone, price_uzs, status_changed_at, cancel_reason
)
select
  'd0000000-0000-0000-0000-000000000001',
  s.staff_id::uuid,
  s.service_id::uuid,
  (d.d::date + s.at_time) at time zone 'Asia/Tashkent',
  (d.d::date + s.at_time) at time zone 'Asia/Tashkent' + make_interval(mins => sv.duration_minutes),
  s.status::public.appointment_status,
  s.source::public.appointment_source,
  s.customer_name,
  s.customer_phone,
  sv.price_uzs,                                          -- snapshot of the sample price
  case when s.status <> 'pending' then now() end,
  case when s.status = 'cancelled' then 'Mijoz vaqtni o''zgartirdi (namuna)' end
from samples s
join days d on d.n = s.day_n
join public.services sv on sv.id = s.service_id::uuid;

-- -----------------------------------------------------------------------------
-- 10. Summary (the runner prints this)
-- -----------------------------------------------------------------------------
select
  (select count(*) from public.staff where business_id = 'd0000000-0000-0000-0000-000000000001') as staff,
  (select count(*) from public.services where business_id = 'd0000000-0000-0000-0000-000000000001') as services,
  (select count(*) from public.staff_services where business_id = 'd0000000-0000-0000-0000-000000000001') as staff_services,
  (select count(*) from public.working_hours where business_id = 'd0000000-0000-0000-0000-000000000001') as working_hours,
  (select count(*) from public.business_members where business_id = 'd0000000-0000-0000-0000-000000000001') as members,
  (select count(*) from public.appointments where business_id = 'd0000000-0000-0000-0000-000000000001') as appointments;
