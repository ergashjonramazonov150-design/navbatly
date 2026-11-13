-- =============================================================================
-- Migration 9 — salon images (M3.5 step 2a)
--
-- In plain words:
--   1. A PUBLIC Storage bucket `salon-images`: anyone with a file's link can view it
--      (photos are meant for the booking page), Supabase refuses files over 5 MB and
--      anything that is not JPEG / PNG / WebP.
--   2. A fixed folder layout, checked by Storage rules:
--        <salon id>/<kind>/<image id>/<size>.<ext>
--        kind = cover | logo | staff | services | gallery     size = lg | sm
--      Only the OWNER of an ACTIVE salon may add or delete files, and only inside
--      their own salon's folder. No overwriting (every upload = new image id).
--   3. Where the database remembers photos (always the `lg` file; `sm` sits next to it):
--        businesses.cover_path, businesses.logo_path, staff.photo_path (renamed from the
--        unused photo_url), services.photo_path, and a new table salon_photos
--        («Ishlarimiz», max 12 per salon). Every path must start with the row's OWN
--        salon id, so a salon can never point at another salon's file.
--   4. public.list_orphan_salon_images(): files no row points to (left over after a
--      failed step). Only the server (secret key) may call it — see
--      docs/ARCHITECTURE.md "Salon images: upload order and orphan clean-up".
-- Tests: supabase/tests/06_salon_images_test.sql
-- =============================================================================

-- Pattern pieces (kept in sync with private.is_own_salon_image below):
--   uuid   = [0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}
--   stored = '<salon id>/<kind>/<uuid>/lg.(webp|jpg|png)'

-- -----------------------------------------------------------------------------
-- 1. The bucket
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'salon-images',
  'salon-images',
  true,                                            -- read by link, cached by the CDN
  5 * 1024 * 1024,                                 -- 5 MB per file (browser compresses first)
  array['image/jpeg', 'image/png', 'image/webp']
);

-- -----------------------------------------------------------------------------
-- 2. Storage rules (policies on storage.objects)
-- -----------------------------------------------------------------------------
-- true when `p_name` has the exact layout AND its first folder is a salon I own
-- (my_owned_business_ids already skips inactive salons — migration 7).
-- Text comparison (no ::uuid cast) so a malformed name can never raise an error.
-- SECURITY DEFINER like the other private helpers: the body looks up
-- private.my_owned_business_ids() by name at run time, and API roles have no USAGE on
-- the private schema. It still answers for the CALLER (auth.uid() comes from the JWT).
create function private.is_own_salon_image(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(cover|logo|staff|services|gallery)/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(lg|sm)\.(webp|jpg|png)$'
     and split_part(p_name, '/', 1) in (select b::text from private.my_owned_business_ids() b);
$$;
revoke execute on function private.is_own_salon_image(text) from public, anon;
grant execute on function private.is_own_salon_image(text) to authenticated;

create policy "Owners can upload images of their salon"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'salon-images' and private.is_own_salon_image(name));

-- needed by the Storage API to delete; also lets owners list their own files
create policy "Owners can see image files of their salon"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'salon-images' and private.is_own_salon_image(name));

create policy "Owners can delete images of their salon"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'salon-images' and private.is_own_salon_image(name));

-- No UPDATE policy on purpose: files are never overwritten.
-- No SELECT policy for visitors: a public bucket serves files by link without one.

-- -----------------------------------------------------------------------------
-- 3a. Photo columns on existing tables
-- -----------------------------------------------------------------------------
alter table public.businesses
  add column cover_path text,
  add column logo_path text,
  add constraint businesses_cover_path_check check (
    cover_path ~ ('^' || id::text || '/cover/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/lg\.(webp|jpg|png)$')
  ),
  add constraint businesses_logo_path_check check (
    logo_path ~ ('^' || id::text || '/logo/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/lg\.(webp|jpg|png)$')
  );
-- (a CHECK on a NULL value passes, so "no photo" is always allowed)

-- staff.photo_url was never used: rename it and replace the old "≤ 500 chars" rule.
-- Existing column grants (migration 4) follow the column through the rename.
alter table public.staff rename column photo_url to photo_path;
alter table public.staff
  drop constraint staff_photo_url_check,
  add constraint staff_photo_path_check check (
    photo_path ~ ('^' || business_id::text || '/staff/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/lg\.(webp|jpg|png)$')
  );

alter table public.services
  add column photo_path text,
  add constraint services_photo_path_check check (
    photo_path ~ ('^' || business_id::text || '/services/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/lg\.(webp|jpg|png)$')
  );

-- Owners may set these (existing "Owners can update …" policies decide WHICH rows)
grant update (cover_path, logo_path) on public.businesses to authenticated;
grant update (photo_path) on public.services to authenticated;
-- staff.photo_path: already granted (as photo_url) in migration 4

-- -----------------------------------------------------------------------------
-- 3b. «Ishlarimiz» gallery
-- -----------------------------------------------------------------------------
create table public.salon_photos (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  path text not null unique,
  created_at timestamptz not null default now(),
  constraint salon_photos_path_check check (
    path ~ ('^' || business_id::text || '/gallery/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/lg\.(webp|jpg|png)$')
  )
);
comment on table public.salon_photos is
  '«Ishlarimiz» work photos, max 12 per salon. Order = upload order (created_at). No updates: delete + add.';
create index salon_photos_business_created_idx on public.salon_photos (business_id, created_at);

alter table public.salon_photos enable row level security;

grant select on public.salon_photos to anon, authenticated;
grant insert (business_id, path), delete on public.salon_photos to authenticated;

create policy "Visitors can view photos of active businesses"
  on public.salon_photos for select
  to anon
  using (exists (select 1 from public.businesses b where b.id = business_id and b.is_active));

create policy "Users can view public photos and all photos of their business"
  on public.salon_photos for select
  to authenticated
  using (
    exists (select 1 from public.businesses b where b.id = business_id and b.is_active)
    or business_id in (select private.my_business_ids())
  );

create policy "Owners can add photos"
  on public.salon_photos for insert
  to authenticated
  with check (business_id in (select private.my_owned_business_ids()));

create policy "Owners can delete photos"
  on public.salon_photos for delete
  to authenticated
  using (business_id in (select private.my_owned_business_ids()));

-- Max 12 per salon. The advisory lock makes two parallel uploads wait for each other,
-- so the 13th is refused even if both arrive in the same millisecond.
create function private.enforce_gallery_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('salon_photos:' || new.business_id::text, 0));
  if (select count(*) from public.salon_photos where business_id = new.business_id) >= 12 then
    raise exception 'GALLERY_FULL';           -- errcode P0001; the app translates the code
  end if;
  return new;
end
$$;
revoke execute on function private.enforce_gallery_limit() from public, anon, authenticated;

create trigger salon_photos_limit
  before insert on public.salon_photos
  for each row execute function private.enforce_gallery_limit();

-- -----------------------------------------------------------------------------
-- 4. Orphan finder (server only)
-- -----------------------------------------------------------------------------
-- Files in the bucket that NO row points to, older than p_older_than (default 1 day,
-- so uploads still in progress are never touched). A `sm` file belongs to the `lg`
-- in the same folder. Deleting must go through the Storage API (Supabase blocks
-- direct SQL deletes from storage.objects), so this only LISTS.
create function public.list_orphan_salon_images(p_older_than interval default interval '1 day')
returns table (name text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  with referenced as (
    select regexp_replace(p, '/lg\.(webp|jpg|png)$', '') as folder
    from (
      select cover_path as p from public.businesses where cover_path is not null
      union all select logo_path from public.businesses where logo_path is not null
      union all select photo_path from public.staff where photo_path is not null
      union all select photo_path from public.services where photo_path is not null
      union all select path from public.salon_photos
    ) all_paths
  )
  select o.name, o.created_at
  from storage.objects o
  where o.bucket_id = 'salon-images'
    and o.created_at < now() - p_older_than
    and regexp_replace(o.name, '/[^/]+$', '') not in (select folder from referenced)
  order by o.created_at;
$$;
revoke execute on function public.list_orphan_salon_images(interval) from public, anon, authenticated;
grant execute on function public.list_orphan_salon_images(interval) to service_role;
