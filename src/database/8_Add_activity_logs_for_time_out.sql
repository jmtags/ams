alter table public.shifts
add column if not exists require_activity_log_before_clock_out boolean not null default false;

alter table public.shifts
add column if not exists activity_log_label text;

alter table public.shifts
add column if not exists min_activity_entries integer not null default 1;

create table if not exists public.attendance_activity_logs (
  id uuid primary key default gen_random_uuid(),
  attendance_id uuid not null references public.attendance(id) on delete cascade,
  user_id uuid not null references public.users(id),
  activity_text text not null,
  activity_order integer not null default 1,
  hours_spent numeric,
  output_note text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table public.attendance
add column if not exists activity_log_submitted boolean not null default false;

alter table public.attendance
add column if not exists activity_log_submitted_at timestamp with time zone;


alter table public.shifts enable row level security;

drop policy if exists "Staff can view shifts" on public.shifts;
drop policy if exists "Staff can insert shifts" on public.shifts;
drop policy if exists "Staff can update shifts" on public.shifts;
drop policy if exists "Staff can delete shifts" on public.shifts;

create policy "Staff can view shifts"
on public.shifts
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

create policy "Staff can insert shifts"
on public.shifts
for insert
to authenticated
with check (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role in ('admin', 'hr', 'payroll')
  )
);

create policy "Staff can update shifts"
on public.shifts
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

create policy "Staff can delete shifts"
on public.shifts
for delete
to authenticated
using (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role in ('admin', 'hr', 'payroll')
  )
);

-- =========================================================
-- HRIS STAFF RLS SETUP
-- Staff roles: admin, hr, payroll
-- Regular employee role: user
-- =========================================================

-- ---------------------------------------------------------
-- Helper note:
-- DO NOT apply recursive policies on public.users that query
-- public.users inside the same policy.
-- Keep public.users simple.
-- ---------------------------------------------------------

alter table public.users enable row level security;

drop policy if exists "Authenticated users can view own profile" on public.users;
drop policy if exists "Authenticated users can update own profile" on public.users;

create policy "Authenticated users can view own profile"
on public.users
for select
to authenticated
using (auth.uid() = id);

create policy "Authenticated users can update own profile"
on public.users
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);


-- =========================================================
-- DEPARTMENTS
-- =========================================================
alter table public.departments enable row level security;

drop policy if exists "Staff can view departments" on public.departments;
drop policy if exists "Staff can insert departments" on public.departments;
drop policy if exists "Staff can update departments" on public.departments;
drop policy if exists "Staff can delete departments" on public.departments;

create policy "Staff can view departments"
on public.departments
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

create policy "Staff can insert departments"
on public.departments
for insert
to authenticated
with check (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role in ('admin', 'hr', 'payroll')
  )
);

create policy "Staff can update departments"
on public.departments
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

create policy "Staff can delete departments"
on public.departments
for delete
to authenticated
using (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role in ('admin', 'hr', 'payroll')
  )
);


-- =========================================================
-- LOCATIONS
-- =========================================================
alter table public.locations enable row level security;

drop policy if exists "Staff can view locations" on public.locations;
drop policy if exists "Staff can insert locations" on public.locations;
drop policy if exists "Staff can update locations" on public.locations;
drop policy if exists "Staff can delete locations" on public.locations;

create policy "Staff can view locations"
on public.locations
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

create policy "Staff can insert locations"
on public.locations
for insert
to authenticated
with check (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role in ('admin', 'hr', 'payroll')
  )
);

create policy "Staff can update locations"
on public.locations
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

create policy "Staff can delete locations"
on public.locations
for delete
to authenticated
using (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role in ('admin', 'hr', 'payroll')
  )
);


-- =========================================================
-- SHIFTS
-- =========================================================
alter table public.shifts enable row level security;

drop policy if exists "Staff can view shifts" on public.shifts;
drop policy if exists "Staff can insert shifts" on public.shifts;
drop policy if exists "Staff can update shifts" on public.shifts;
drop policy if exists "Staff can delete shifts" on public.shifts;

create policy "Staff can view shifts"
on public.shifts
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

create policy "Staff can insert shifts"
on public.shifts
for insert
to authenticated
with check (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role in ('admin', 'hr', 'payroll')
  )
);

create policy "Staff can update shifts"
on public.shifts
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

create policy "Staff can delete shifts"
on public.shifts
for delete
to authenticated
using (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role in ('admin', 'hr', 'payroll')
  )
);


-- =========================================================
-- HOLIDAYS
-- =========================================================
alter table public.holidays enable row level security;

drop policy if exists "Staff can view holidays" on public.holidays;
drop policy if exists "Staff can insert holidays" on public.holidays;
drop policy if exists "Staff can update holidays" on public.holidays;
drop policy if exists "Staff can delete holidays" on public.holidays;

create policy "Staff can view holidays"
on public.holidays
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

create policy "Staff can insert holidays"
on public.holidays
for insert
to authenticated
with check (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role in ('admin', 'hr', 'payroll')
  )
);

create policy "Staff can update holidays"
on public.holidays
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

create policy "Staff can delete holidays"
on public.holidays
for delete
to authenticated
using (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role in ('admin', 'hr', 'payroll')
  )
);


-- =========================================================
-- ATTENDANCE
-- Staff can manage all
-- Users can view their own and insert/update own attendance
-- for normal clock in/out flow
-- =========================================================
alter table public.attendance enable row level security;

drop policy if exists "Staff can view attendance" on public.attendance;
drop policy if exists "Staff can insert attendance" on public.attendance;
drop policy if exists "Staff can update attendance" on public.attendance;
drop policy if exists "Staff can delete attendance" on public.attendance;
drop policy if exists "Users can view own attendance" on public.attendance;
drop policy if exists "Users can insert own attendance" on public.attendance;
drop policy if exists "Users can update own attendance" on public.attendance;

create policy "Staff can view attendance"
on public.attendance
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

create policy "Staff can insert attendance"
on public.attendance
for insert
to authenticated
with check (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role in ('admin', 'hr', 'payroll')
  )
);

create policy "Staff can update attendance"
on public.attendance
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

create policy "Staff can delete attendance"
on public.attendance
for delete
to authenticated
using (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role in ('admin', 'hr', 'payroll')
  )
);

create policy "Users can view own attendance"
on public.attendance
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own attendance"
on public.attendance
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own attendance"
on public.attendance
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);


-- =========================================================
-- LEAVE REQUESTS
-- Staff can manage all
-- Users can manage their own requests
-- =========================================================
alter table public.leave_requests enable row level security;

drop policy if exists "Staff can view leave requests" on public.leave_requests;
drop policy if exists "Staff can insert leave requests" on public.leave_requests;
drop policy if exists "Staff can update leave requests" on public.leave_requests;
drop policy if exists "Staff can delete leave requests" on public.leave_requests;
drop policy if exists "Users can view own leave requests" on public.leave_requests;
drop policy if exists "Users can insert own leave requests" on public.leave_requests;
drop policy if exists "Users can update own leave requests" on public.leave_requests;
drop policy if exists "Users can delete own leave requests" on public.leave_requests;

create policy "Staff can view leave requests"
on public.leave_requests
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

create policy "Staff can insert leave requests"
on public.leave_requests
for insert
to authenticated
with check (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role in ('admin', 'hr', 'payroll')
  )
);

create policy "Staff can update leave requests"
on public.leave_requests
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

create policy "Staff can delete leave requests"
on public.leave_requests
for delete
to authenticated
using (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role in ('admin', 'hr', 'payroll')
  )
);

create policy "Users can view own leave requests"
on public.leave_requests
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own leave requests"
on public.leave_requests
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own leave requests"
on public.leave_requests
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own leave requests"
on public.leave_requests
for delete
to authenticated
using (auth.uid() = user_id);


-- =========================================================
-- LEAVE REQUEST DATES
-- =========================================================
alter table public.leave_request_dates enable row level security;

drop policy if exists "Staff can view leave request dates" on public.leave_request_dates;
drop policy if exists "Staff can insert leave request dates" on public.leave_request_dates;
drop policy if exists "Staff can update leave request dates" on public.leave_request_dates;
drop policy if exists "Staff can delete leave request dates" on public.leave_request_dates;
drop policy if exists "Users can view own leave request dates" on public.leave_request_dates;
drop policy if exists "Users can insert own leave request dates" on public.leave_request_dates;
drop policy if exists "Users can update own leave request dates" on public.leave_request_dates;
drop policy if exists "Users can delete own leave request dates" on public.leave_request_dates;

create policy "Staff can view leave request dates"
on public.leave_request_dates
for select
to authenticated
using (
  exists (
    select 1
    from public.users staff
    where staff.id = auth.uid()
      and staff.role in ('admin', 'hr', 'payroll')
  )
);

create policy "Staff can insert leave request dates"
on public.leave_request_dates
for insert
to authenticated
with check (
  exists (
    select 1
    from public.users staff
    where staff.id = auth.uid()
      and staff.role in ('admin', 'hr', 'payroll')
  )
);

create policy "Staff can update leave request dates"
on public.leave_request_dates
for update
to authenticated
using (
  exists (
    select 1
    from public.users staff
    where staff.id = auth.uid()
      and staff.role in ('admin', 'hr', 'payroll')
  )
)
with check (
  exists (
    select 1
    from public.users staff
    where staff.id = auth.uid()
      and staff.role in ('admin', 'hr', 'payroll')
  )
);

create policy "Staff can delete leave request dates"
on public.leave_request_dates
for delete
to authenticated
using (
  exists (
    select 1
    from public.users staff
    where staff.id = auth.uid()
      and staff.role in ('admin', 'hr', 'payroll')
  )
);

create policy "Users can view own leave request dates"
on public.leave_request_dates
for select
to authenticated
using (
  exists (
    select 1
    from public.leave_requests lr
    where lr.id = leave_request_id
      and lr.user_id = auth.uid()
  )
);

create policy "Users can insert own leave request dates"
on public.leave_request_dates
for insert
to authenticated
with check (
  exists (
    select 1
    from public.leave_requests lr
    where lr.id = leave_request_id
      and lr.user_id = auth.uid()
  )
);

create policy "Users can update own leave request dates"
on public.leave_request_dates
for update
to authenticated
using (
  exists (
    select 1
    from public.leave_requests lr
    where lr.id = leave_request_id
      and lr.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.leave_requests lr
    where lr.id = leave_request_id
      and lr.user_id = auth.uid()
  )
);

create policy "Users can delete own leave request dates"
on public.leave_request_dates
for delete
to authenticated
using (
  exists (
    select 1
    from public.leave_requests lr
    where lr.id = leave_request_id
      and lr.user_id = auth.uid()
  )
);


-- =========================================================
-- ATTENDANCE ADJUSTMENTS
-- Staff can manage all
-- Users can manage/view their own requests
-- =========================================================
alter table public.attendance_adjustments enable row level security;

drop policy if exists "Staff can view attendance adjustments" on public.attendance_adjustments;
drop policy if exists "Staff can insert attendance adjustments" on public.attendance_adjustments;
drop policy if exists "Staff can update attendance adjustments" on public.attendance_adjustments;
drop policy if exists "Staff can delete attendance adjustments" on public.attendance_adjustments;
drop policy if exists "Users can view own attendance adjustments" on public.attendance_adjustments;
drop policy if exists "Users can insert own attendance adjustments" on public.attendance_adjustments;
drop policy if exists "Users can update own attendance adjustments" on public.attendance_adjustments;
drop policy if exists "Users can delete own attendance adjustments" on public.attendance_adjustments;

create policy "Staff can view attendance adjustments"
on public.attendance_adjustments
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

create policy "Staff can insert attendance adjustments"
on public.attendance_adjustments
for insert
to authenticated
with check (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role in ('admin', 'hr', 'payroll')
  )
);

create policy "Staff can update attendance adjustments"
on public.attendance_adjustments
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

create policy "Staff can delete attendance adjustments"
on public.attendance_adjustments
for delete
to authenticated
using (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role in ('admin', 'hr', 'payroll')
  )
);

create policy "Users can view own attendance adjustments"
on public.attendance_adjustments
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own attendance adjustments"
on public.attendance_adjustments
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own attendance adjustments"
on public.attendance_adjustments
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own attendance adjustments"
on public.attendance_adjustments
for delete
to authenticated
using (auth.uid() = user_id);


-- =========================================================
-- ATTENDANCE ACTIVITY LOGS
-- Staff can manage all
-- Users can manage their own logs
-- =========================================================
alter table public.attendance_activity_logs enable row level security;

drop policy if exists "Staff can view attendance activity logs" on public.attendance_activity_logs;
drop policy if exists "Staff can insert attendance activity logs" on public.attendance_activity_logs;
drop policy if exists "Staff can update attendance activity logs" on public.attendance_activity_logs;
drop policy if exists "Staff can delete attendance activity logs" on public.attendance_activity_logs;
drop policy if exists "Users can view own attendance activity logs" on public.attendance_activity_logs;
drop policy if exists "Users can insert own attendance activity logs" on public.attendance_activity_logs;
drop policy if exists "Users can update own attendance activity logs" on public.attendance_activity_logs;
drop policy if exists "Users can delete own attendance activity logs" on public.attendance_activity_logs;

create policy "Staff can view attendance activity logs"
on public.attendance_activity_logs
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

create policy "Staff can insert attendance activity logs"
on public.attendance_activity_logs
for insert
to authenticated
with check (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role in ('admin', 'hr', 'payroll')
  )
);

create policy "Staff can update attendance activity logs"
on public.attendance_activity_logs
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

create policy "Staff can delete attendance activity logs"
on public.attendance_activity_logs
for delete
to authenticated
using (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role in ('admin', 'hr', 'payroll')
  )
);

create policy "Users can view own attendance activity logs"
on public.attendance_activity_logs
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own attendance activity logs"
on public.attendance_activity_logs
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own attendance activity logs"
on public.attendance_activity_logs
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own attendance activity logs"
on public.attendance_activity_logs
for delete
to authenticated
using (auth.uid() = user_id);


-- =========================================================
-- OPTIONAL: LEAVE BALANCES / LEAVE TYPES / USER REST DAYS
-- Useful if frontend accesses them directly
-- =========================================================

alter table public.leave_balances enable row level security;
drop policy if exists "Staff can view leave balances" on public.leave_balances;
drop policy if exists "Staff can manage leave balances" on public.leave_balances;
drop policy if exists "Users can view own leave balances" on public.leave_balances;

create policy "Staff can view leave balances"
on public.leave_balances
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

create policy "Staff can manage leave balances"
on public.leave_balances
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

create policy "Users can view own leave balances"
on public.leave_balances
for select
to authenticated
using (auth.uid() = user_id);


alter table public.leave_types enable row level security;
drop policy if exists "Staff can manage leave types" on public.leave_types;
drop policy if exists "Users can view active leave types" on public.leave_types;

create policy "Staff can manage leave types"
on public.leave_types
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

create policy "Users can view active leave types"
on public.leave_types
for select
to authenticated
using (is_active = true);


alter table public.user_rest_days enable row level security;
drop policy if exists "Staff can manage user rest days" on public.user_rest_days;
drop policy if exists "Users can view own rest days" on public.user_rest_days;

create policy "Staff can manage user rest days"
on public.user_rest_days
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

create policy "Users can view own rest days"
on public.user_rest_days
for select
to authenticated
using (auth.uid() = user_id);