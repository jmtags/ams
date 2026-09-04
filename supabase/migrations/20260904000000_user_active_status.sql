alter table public.users
  add column if not exists is_active boolean not null default true;

update public.users
set is_active = true
where is_active is null;

create index if not exists idx_users_is_active
  on public.users(is_active);
