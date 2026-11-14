-- =============================================================================
-- Migration 10 — Telegram linking ("Botni ulash", M6)
--
-- In plain words:
--   1. One-time link codes: the owner presses "Botni ulash" → the browser makes a random
--      code, the database keeps only its SHA-256 hash for 10 minutes. The owner opens
--      t.me/navbatly_uz_bot?start=<code> and presses Start; our webhook (server) turns the
--      code into "this chat belongs to this salon". A code works once.
--   2. Owners can no longer type a chat ID or create the settings row themselves — only the
--      webhook links a chat. Owners can still switch notifications on/off and "Uzish".
--   3. Two new columns: linked_at (when) and chat_title (whose Telegram, shown in Sozlamalar).
-- Tests: supabase/tests/07_telegram_test.sql
-- =============================================================================

alter table public.business_telegram_settings
  add column linked_at timestamptz,
  add column chat_title text check (char_length(chat_title) <= 128);

-- only the server (webhook) sets chat_id / creates the row
revoke insert on public.business_telegram_settings from authenticated;
revoke update (chat_id) on public.business_telegram_settings from authenticated;
drop policy "Owners can create telegram settings" on public.business_telegram_settings;

-- -----------------------------------------------------------------------------
-- 1. Link codes (private schema: never reachable through the API)
-- -----------------------------------------------------------------------------
create table private.telegram_link_codes (
  code_hash text primary key check (code_hash ~ '^[0-9a-f]{64}$'),
  business_id uuid not null references public.businesses (id) on delete cascade,
  created_by uuid not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index telegram_link_codes_business_idx on private.telegram_link_codes (business_id);
alter table private.telegram_link_codes enable row level security; -- no policies: functions only

-- Owner: store a new code (32+ random chars made in the browser). Old/expired codes of the
-- salon are removed, so only the newest link works.
create function public.telegram_create_link_code(p_business_id uuid, p_code text)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_expires timestamptz := now() + interval '10 minutes';
begin
  if p_business_id not in (select private.my_owned_business_ids()) then
    raise exception using errcode = 'P0001', message = 'NOT_ALLOWED';
  end if;
  if p_code is null or p_code !~ '^[A-Za-z0-9_-]{32,64}$' then
    raise exception using errcode = 'P0001', message = 'INVALID_REQUEST';
  end if;
  delete from private.telegram_link_codes
  where business_id = p_business_id or expires_at < now();
  insert into private.telegram_link_codes (code_hash, business_id, created_by, expires_at)
  values (encode(sha256(convert_to(p_code, 'UTF8')), 'hex'), p_business_id, (select auth.uid()), v_expires);
  return v_expires;
end
$$;
revoke execute on function public.telegram_create_link_code(uuid, text) from public, anon;
grant execute on function public.telegram_create_link_code(uuid, text) to authenticated;

-- Server (webhook, secret key): /start <code> → link the chat. Returns the salon name, or
-- null when the code is unknown / expired / already used.
create function public.telegram_link_chat(p_code text, p_chat_id text, p_chat_title text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_code private.telegram_link_codes%rowtype;
  v_name text;
begin
  delete from private.telegram_link_codes
  where code_hash = encode(sha256(convert_to(coalesce(p_code, ''), 'UTF8')), 'hex')
    and expires_at > now()
  returning * into v_code;
  if not found then
    return null;
  end if;
  insert into public.business_telegram_settings
    (business_id, chat_id, chat_title, is_enabled, linked_at, last_error, last_error_at)
  values (v_code.business_id, p_chat_id, left(p_chat_title, 128), true, now(), null, null)
  on conflict (business_id) do update
    set chat_id = excluded.chat_id, chat_title = excluded.chat_title, is_enabled = true,
        linked_at = now(), last_error = null, last_error_at = null;
  select name into v_name from public.businesses where id = v_code.business_id;
  return v_name;
end
$$;
revoke execute on function public.telegram_link_chat(text, text, text) from public, anon, authenticated;
grant execute on function public.telegram_link_chat(text, text, text) to service_role;

-- Owner: "Uzish" — forget the chat (notifications stop).
create function public.telegram_unlink(p_business_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_business_id not in (select private.my_owned_business_ids()) then
    raise exception using errcode = 'P0001', message = 'NOT_ALLOWED';
  end if;
  update public.business_telegram_settings
  set chat_id = null, chat_title = null, is_enabled = false, linked_at = null,
      last_error = null, last_error_at = null
  where business_id = p_business_id;
end
$$;
revoke execute on function public.telegram_unlink(uuid) from public, anon;
grant execute on function public.telegram_unlink(uuid) to authenticated;
