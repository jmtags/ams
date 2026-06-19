-- Global announcement support and instance mode settings.

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references public.users(id),
  updated_at timestamp with time zone not null default now()
);

insert into public.app_settings (key, value)
values (
  'instance_config',
  jsonb_build_object(
    'mode', 'sub',
    'mainAnnouncementApiUrl', '',
    'mainAnnouncementAnonKey', '',
    'showAnnouncementPopup', true
  )
)
on conflict (key) do nothing;

update public.app_settings
set value = coalesce(value, '{}'::jsonb) ||
  jsonb_build_object(
    'mainAnnouncementAnonKey',
    coalesce(value->>'mainAnnouncementAnonKey', '')
  )
where key = 'instance_config';

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  image_url text,
  severity text not null default 'info'
    check (severity in ('info', 'warning', 'urgent')),
  is_active boolean not null default true,
  starts_at timestamp with time zone,
  ends_at timestamp with time zone,
  created_by uuid references public.users(id),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table public.announcements
  add column if not exists image_url text;

insert into storage.buckets (id, name, public)
values ('announcement-images', 'announcement-images', true)
on conflict (id) do update
set public = true;

create index if not exists idx_announcements_active_dates
on public.announcements(is_active, starts_at, ends_at);

alter table public.app_settings enable row level security;
alter table public.announcements enable row level security;

drop policy if exists "Authenticated users can read app settings" on public.app_settings;
drop policy if exists "Staff can manage app settings" on public.app_settings;
drop policy if exists "Authenticated users can view active announcements" on public.announcements;
drop policy if exists "Staff can manage announcements" on public.announcements;
drop policy if exists "Public can view announcement images" on storage.objects;
drop policy if exists "Staff can upload announcement images" on storage.objects;
drop policy if exists "Staff can update announcement images" on storage.objects;
drop policy if exists "Staff can delete announcement images" on storage.objects;

create policy "Authenticated users can read app settings"
on public.app_settings
for select
to authenticated
using (true);

create policy "Staff can manage app settings"
on public.app_settings
for all
to authenticated
using (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role in ('admin', 'hr', 'payroll')
  )
)
with check (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role in ('admin', 'hr', 'payroll')
  )
);

create policy "Authenticated users can view active announcements"
on public.announcements
for select
to authenticated
using (
  is_active = true
  and (starts_at is null or starts_at <= now())
  and (ends_at is null or ends_at >= now())
);

create policy "Staff can manage announcements"
on public.announcements
for all
to authenticated
using (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role in ('admin', 'hr', 'payroll')
  )
)
with check (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role in ('admin', 'hr', 'payroll')
  )
);

create policy "Public can view announcement images"
on storage.objects
for select
to public
using (bucket_id = 'announcement-images');

create policy "Staff can upload announcement images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'announcement-images'
  and exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role in ('admin', 'hr', 'payroll')
  )
);

create policy "Staff can update announcement images"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'announcement-images'
  and exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role in ('admin', 'hr', 'payroll')
  )
)
with check (
  bucket_id = 'announcement-images'
  and exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role in ('admin', 'hr', 'payroll')
  )
);

create policy "Staff can delete announcement images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'announcement-images'
  and exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role in ('admin', 'hr', 'payroll')
  )
);
