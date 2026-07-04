-- Employee profile pictures uploaded from the employee dashboard.

alter table public.users
  add column if not exists profile_picture_url text,
  add column if not exists profile_picture_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-pictures',
  'profile-pictures',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']::text[];

drop policy if exists "Public can view profile pictures" on storage.objects;
drop policy if exists "Employees can upload own profile pictures" on storage.objects;
drop policy if exists "Employees can update own profile pictures" on storage.objects;
drop policy if exists "Employees can delete own profile pictures" on storage.objects;

create policy "Public can view profile pictures"
on storage.objects for select to public
using (bucket_id = 'profile-pictures');

create policy "Employees can upload own profile pictures"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'profile-pictures'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Employees can update own profile pictures"
on storage.objects for update to authenticated
using (
  bucket_id = 'profile-pictures'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'profile-pictures'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Employees can delete own profile pictures"
on storage.objects for delete to authenticated
using (
  bucket_id = 'profile-pictures'
  and (storage.foldername(name))[1] = auth.uid()::text
);
