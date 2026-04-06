alter table public.attendance
add column if not exists entry_mode text not null default 'self'
check (entry_mode in ('self', 'manual', 'adjusted'));

alter table public.attendance
add column if not exists manual_reason text;

alter table public.attendance
add column if not exists created_by uuid references public.users(id);

alter table public.attendance
add column if not exists updated_by uuid references public.users(id);

alter table public.attendance
add column if not exists updated_at timestamp with time zone default now();


create table if not exists public.attendance_adjustments (
  id uuid primary key default gen_random_uuid(),
  attendance_id uuid not null references public.attendance(id) on delete cascade,
  user_id uuid not null references public.users(id),
  request_type text not null default 'punch_alteration'
    check (request_type in ('punch_alteration')),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),

  previous_clock_in timestamp with time zone,
  previous_clock_out timestamp with time zone,

  requested_clock_in timestamp with time zone,
  requested_clock_out timestamp with time zone,
  request_reason text not null,

  approved_clock_in timestamp with time zone,
  approved_clock_out timestamp with time zone,
  admin_remarks text,

  created_by uuid not null references public.users(id),
  reviewed_by uuid references public.users(id),

  created_at timestamp with time zone not null default now(),
  reviewed_at timestamp with time zone
);

create unique index if not exists attendance_user_date_unique
on public.attendance(user_id, date);

