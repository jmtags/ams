-- Date-specific employee shift change requests

create table if not exists public.shift_change_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  request_date date not null,
  requested_shift_id uuid not null references public.shifts(id),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  request_reason text not null,
  admin_remarks text,
  created_by uuid not null references public.users(id),
  reviewed_by uuid references public.users(id),
  created_at timestamp with time zone not null default now(),
  reviewed_at timestamp with time zone,
  updated_at timestamp with time zone not null default now()
);

create index if not exists idx_shift_change_requests_user_date
on public.shift_change_requests(user_id, request_date);

create index if not exists idx_shift_change_requests_status
on public.shift_change_requests(status);

create unique index if not exists idx_shift_change_requests_one_active_per_day
on public.shift_change_requests(user_id, request_date)
where status in ('pending', 'approved');

alter table public.shift_change_requests enable row level security;

drop policy if exists "Users can view own shift change requests" on public.shift_change_requests;
drop policy if exists "Users can create own shift change requests" on public.shift_change_requests;
drop policy if exists "Staff can view shift change requests" on public.shift_change_requests;
drop policy if exists "Staff can update shift change requests" on public.shift_change_requests;

create policy "Users can view own shift change requests"
on public.shift_change_requests
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can create own shift change requests"
on public.shift_change_requests
for insert
to authenticated
with check (
  auth.uid() = user_id
  and auth.uid() = created_by
  and status = 'pending'
);

create policy "Staff can view shift change requests"
on public.shift_change_requests
for select
to authenticated
using (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role in ('admin', 'hr', 'payroll')
  )
);

create policy "Staff can update shift change requests"
on public.shift_change_requests
for update
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
