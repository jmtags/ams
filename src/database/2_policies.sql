-- =========================================================
-- RLS / POLICIES SCRIPT
-- Based on uploaded Supabase policies CSV
-- =========================================================

-- ---------------------------------------------------------
-- OPTIONAL: helper function used by some policies
-- ---------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'admin'
  );
$$;

grant execute on function public.is_admin() to authenticated, anon, public;

-- =========================================================
-- ENABLE RLS
-- =========================================================

alter table public.attendance enable row level security;
alter table public.departments enable row level security;
alter table public.locations enable row level security;
alter table public.shifts enable row level security;
alter table public.users enable row level security;

-- storage.objects is managed by Supabase, but policies can still be created on it

-- =========================================================
-- CLEAN EXISTING POLICIES FIRST
-- =========================================================

-- attendance
drop policy if exists "Admin full access attendance" on public.attendance;
drop policy if exists "Users can insert attendance" on public.attendance;
drop policy if exists "Users can insert own attendance" on public.attendance;
drop policy if exists "Users can update own attendance" on public.attendance;
drop policy if exists "Users can view own attendance" on public.attendance;
drop policy if exists "Users manage own attendance" on public.attendance;

-- departments
drop policy if exists "Admin manage departments" on public.departments;
drop policy if exists "Allow delete departments" on public.departments;
drop policy if exists "Allow update departments" on public.departments;
drop policy if exists "Read departments" on public.departments;
drop policy if exists "authenticated can view departments" on public.departments;

-- locations
drop policy if exists "Admin manage locations" on public.locations;
drop policy if exists "Authenticated users can read locations" on public.locations;
drop policy if exists "Read locations" on public.locations;
drop policy if exists "authenticated can view locations" on public.locations;

-- shifts
drop policy if exists "authenticated can view shifts" on public.shifts;

-- users
drop policy if exists "Allow read users" on public.users;
drop policy if exists "Users can select own row" on public.users;
drop policy if exists "Users can update own row" on public.users;
drop policy if exists "Users can view own profile" on public.users;
drop policy if exists "admins can update all users" on public.users;
drop policy if exists "admins can view all users" on public.users;
drop policy if exists "users can update own profile" on public.users;
drop policy if exists "users can view own profile" on public.users;

-- storage.objects
drop policy if exists "Authenticated users can delete leave attachments" on storage.objects;
drop policy if exists "Authenticated users can update leave attachments" on storage.objects;
drop policy if exists "Authenticated users can upload leave attachments" on storage.objects;
drop policy if exists "Authenticated users can view leave attachments" on storage.objects;

drop policy if exists "authenticated can delete company assets" on storage.objects;
drop policy if exists "authenticated can update company assets" on storage.objects;
drop policy if exists "authenticated can upload company assets" on storage.objects;
drop policy if exists "authenticated can view company assets" on storage.objects;

-- =========================================================
-- ATTENDANCE POLICIES
-- =========================================================

create policy "Admin full access attendance"
on public.attendance
as permissive
for all
to public
using (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'admin'
  )
);

create policy "Users can insert attendance"
on public.attendance
as permissive
for insert
to authenticated
with check (
  auth.uid() = user_id
);

create policy "Users can insert own attendance"
on public.attendance
as permissive
for insert
to authenticated
with check (
  user_id = auth.uid()
);

create policy "Users can update own attendance"
on public.attendance
as permissive
for update
to authenticated
using (
  user_id = auth.uid()
);

create policy "Users can view own attendance"
on public.attendance
as permissive
for select
to authenticated
using (
  user_id = auth.uid()
);

create policy "Users manage own attendance"
on public.attendance
as permissive
for all
to public
using (
  auth.uid() = user_id
);

-- =========================================================
-- DEPARTMENTS POLICIES
-- =========================================================

create policy "Admin manage departments"
on public.departments
as permissive
for all
to public
using (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'admin'
  )
);

create policy "Allow delete departments"
on public.departments
as permissive
for delete
to authenticated
using (
  true
);

create policy "Allow update departments"
on public.departments
as permissive
for update
to authenticated
using (
  true
)
with check (
  true
);

create policy "Read departments"
on public.departments
as permissive
for select
to public
using (
  true
);

create policy "authenticated can view departments"
on public.departments
as permissive
for select
to authenticated
using (
  true
);

-- =========================================================
-- LOCATIONS POLICIES
-- =========================================================

create policy "Admin manage locations"
on public.locations
as permissive
for all
to public
using (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'admin'
  )
);

create policy "Authenticated users can read locations"
on public.locations
as permissive
for select
to authenticated
using (
  true
);

create policy "Read locations"
on public.locations
as permissive
for select
to public
using (
  true
);

create policy "authenticated can view locations"
on public.locations
as permissive
for select
to authenticated
using (
  true
);

-- =========================================================
-- SHIFTS POLICIES
-- =========================================================

create policy "authenticated can view shifts"
on public.shifts
as permissive
for select
to authenticated
using (
  true
);

-- =========================================================
-- USERS POLICIES
-- =========================================================

create policy "Allow read users"
on public.users
as permissive
for select
to authenticated
using (
  true
);

create policy "Users can select own row"
on public.users
as permissive
for select
to authenticated
using (
  id = auth.uid()
);

create policy "Users can update own row"
on public.users
as permissive
for update
to authenticated
using (
  id = auth.uid()
);

create policy "Users can view own profile"
on public.users
as permissive
for select
to public
using (
  auth.uid() = id
);

create policy "admins can update all users"
on public.users
as permissive
for update
to authenticated
using (
  public.is_admin()
)
with check (
  public.is_admin()
);

create policy "admins can view all users"
on public.users
as permissive
for select
to authenticated
using (
  public.is_admin()
);

create policy "users can update own profile"
on public.users
as permissive
for update
to authenticated
using (
  id = auth.uid()
)
with check (
  id = auth.uid()
);

create policy "users can view own profile"
on public.users
as permissive
for select
to authenticated
using (
  id = auth.uid()
);

-- =========================================================
-- STORAGE POLICIES
-- =========================================================

-- LEAVE ATTACHMENTS
create policy "Authenticated users can delete leave attachments"
on storage.objects
as permissive
for delete
to authenticated
using (
  bucket_id = 'leave-attachments'
);

create policy "Authenticated users can update leave attachments"
on storage.objects
as permissive
for update
to authenticated
using (
  bucket_id = 'leave-attachments'
)
with check (
  bucket_id = 'leave-attachments'
);

create policy "Authenticated users can upload leave attachments"
on storage.objects
as permissive
for insert
to authenticated
with check (
  bucket_id = 'leave-attachments'
);

create policy "Authenticated users can view leave attachments"
on storage.objects
as permissive
for select
to authenticated
using (
  bucket_id = 'leave-attachments'
);

-- COMPANY ASSETS
create policy "authenticated can delete company assets"
on storage.objects
as permissive
for delete
to authenticated
using (
  bucket_id = 'company-assets'
);

create policy "authenticated can update company assets"
on storage.objects
as permissive
for update
to authenticated
using (
  bucket_id = 'company-assets'
)
with check (
  bucket_id = 'company-assets'
);

create policy "authenticated can upload company assets"
on storage.objects
as permissive
for insert
to authenticated
with check (
  bucket_id = 'company-assets'
);

create policy "authenticated can view company assets"
on storage.objects
as permissive
for select
to authenticated
using (
  bucket_id = 'company-assets'
);

-- =========================================================
-- OPTIONAL: CREATE STORAGE BUCKETS IF NEEDED
-- Uncomment only if the buckets do not exist yet
-- =========================================================

-- insert into storage.buckets (id, name, public)
-- values ('leave-attachments', 'leave-attachments', false)
-- on conflict (id) do nothing;

-- insert into storage.buckets (id, name, public)
-- values ('company-assets', 'company-assets', false)
-- on conflict (id) do nothing;