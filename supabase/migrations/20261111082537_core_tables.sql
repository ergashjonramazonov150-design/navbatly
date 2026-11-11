-- =============================================================================
-- Migration 2: core tables
-- See docs/ARCHITECTURE.md §3.3 and §3.4
--
-- Conventions:
--   * every business table has business_id → businesses(id) ON DELETE CASCADE
--   * "composite" foreign keys (x_id, business_id) → x(id, business_id) make it
--     impossible to link rows from two different businesses
--   * RLS is enabled on every table at the end. With no policies yet, nobody
--     (except the server) can read or write anything — safe default.
--   * The EXCLUDE (no-overlap) constraints and indexes come in migration 3.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- businesses — one row per salon / barbershop
-- -----------------------------------------------------------------------------
create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 100),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,40}$'),
  phone text check (phone ~ '^\+998[0-9]{9}$'),
  address text check (char_length(address) <= 200),
  timezone text not null default 'Asia/Tashkent',
  default_locale text not null default 'uz' check (default_locale in ('uz', 'ru')),
  slot_step_minutes smallint not null default 15
    check (slot_step_minutes in (5, 10, 15, 20, 30, 60)),
  booking_horizon_days smallint not null default 30
    check (booking_horizon_days between 1 and 90),
  min_notice_minutes smallint not null default 60
    check (min_notice_minutes between 0 and 1440),
  max_active_bookings_per_phone smallint not null default 3
    check (max_active_bookings_per_phone between 1 and 20),
  auto_confirm boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- staff — people customers can book (a login is optional, see business_members)
-- -----------------------------------------------------------------------------
create table public.staff (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  full_name text not null check (char_length(btrim(full_name)) between 2 and 80),
  photo_url text check (char_length(photo_url) <= 500),
  bio text check (char_length(bio) <= 300),
  is_active boolean not null default true,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, business_id) -- target for composite foreign keys
);

-- -----------------------------------------------------------------------------
-- services — what can be booked (haircut, beard trim, ...)
-- -----------------------------------------------------------------------------
create table public.services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 80),
  description text check (char_length(description) <= 300),
  duration_minutes smallint not null check (duration_minutes between 5 and 480),
  price_uzs integer not null check (price_uzs >= 0),
  is_active boolean not null default true,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, business_id)
);

-- -----------------------------------------------------------------------------
-- business_members — who can LOG IN to which business, and with what role
-- -----------------------------------------------------------------------------
create table public.business_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.member_role not null,
  staff_id uuid, -- optional link to the person's bookable staff profile
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, user_id),
  unique (staff_id),
  foreign key (staff_id, business_id) references public.staff (id, business_id)
    on delete set null (staff_id)
);

-- -----------------------------------------------------------------------------
-- staff_services — which staff member can do which service
-- -----------------------------------------------------------------------------
create table public.staff_services (
  business_id uuid not null references public.businesses (id) on delete cascade,
  staff_id uuid not null,
  service_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (staff_id, service_id),
  foreign key (staff_id, business_id) references public.staff (id, business_id)
    on delete cascade,
  foreign key (service_id, business_id) references public.services (id, business_id)
    on delete cascade
);

-- -----------------------------------------------------------------------------
-- working_hours — weekly template, in the business's LOCAL time
-- weekday: 1 = Monday ... 7 = Sunday (ISO). Lunch break = two rows per day.
-- -----------------------------------------------------------------------------
create table public.working_hours (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  staff_id uuid not null,
  weekday smallint not null check (weekday between 1 and 7),
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time),
  foreign key (staff_id, business_id) references public.staff (id, business_id)
    on delete cascade
);

-- -----------------------------------------------------------------------------
-- time_off — vacations, sick days, holidays.
-- staff_id NULL = the whole business is closed.
-- -----------------------------------------------------------------------------
create table public.time_off (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  staff_id uuid,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text check (char_length(reason) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  foreign key (staff_id, business_id) references public.staff (id, business_id)
    on delete cascade
);

-- -----------------------------------------------------------------------------
-- appointments — the bookings themselves
-- Staff/services referenced here can't be deleted (default NO ACTION);
-- they are deactivated instead (is_active = false).
-- -----------------------------------------------------------------------------
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  staff_id uuid not null,
  service_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null, -- always computed by the server from the service duration
  status public.appointment_status not null default 'pending',
  source public.appointment_source not null,
  customer_name text not null check (char_length(btrim(customer_name)) between 2 and 80),
  customer_phone text not null check (customer_phone ~ '^\+998[0-9]{9}$'),
  customer_note text check (char_length(customer_note) <= 300),
  price_uzs integer not null check (price_uzs >= 0), -- price snapshot at booking time
  status_changed_at timestamptz,
  status_changed_by uuid references auth.users (id) on delete set null,
  cancel_reason text check (char_length(cancel_reason) <= 200),
  created_by uuid references auth.users (id) on delete set null, -- set for admin bookings
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (ends_at - starts_at <= interval '8 hours'),
  foreign key (staff_id, business_id) references public.staff (id, business_id),
  foreign key (service_id, business_id) references public.services (id, business_id)
);

-- -----------------------------------------------------------------------------
-- business_telegram_settings — PRIVATE to owners (businesses is publicly readable,
-- and RLS hides rows, not columns — so private fields live in their own table)
-- -----------------------------------------------------------------------------
create table public.business_telegram_settings (
  business_id uuid primary key references public.businesses (id) on delete cascade,
  chat_id text check (chat_id ~ '^-?[0-9]{1,20}$'),
  is_enabled boolean not null default false,
  last_error text check (char_length(last_error) <= 500),
  last_error_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- private.booking_attempts — rate limiting for the public booking form.
-- Lives in the PRIVATE schema: not reachable from the API at all.
-- We store a salted hash of the IP, never the raw IP.
-- -----------------------------------------------------------------------------
create table private.booking_attempts (
  id bigint generated always as identity primary key,
  business_id uuid not null references public.businesses (id) on delete cascade,
  ip_hash text not null check (char_length(ip_hash) between 16 and 128),
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- updated_at triggers
-- -----------------------------------------------------------------------------
create trigger set_updated_at before update on public.businesses
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.staff
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.services
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.business_members
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.working_hours
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.time_off
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.appointments
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.business_telegram_settings
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Row Level Security: ON for every table, no policies yet = deny all.
-- Policies are added in migration 4.
-- -----------------------------------------------------------------------------
alter table public.businesses enable row level security;
alter table public.staff enable row level security;
alter table public.services enable row level security;
alter table public.business_members enable row level security;
alter table public.staff_services enable row level security;
alter table public.working_hours enable row level security;
alter table public.time_off enable row level security;
alter table public.appointments enable row level security;
alter table public.business_telegram_settings enable row level security;
alter table private.booking_attempts enable row level security;
