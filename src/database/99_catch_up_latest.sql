-- HRIS catch-up migration for existing instances.
-- Run this once from the Supabase SQL editor on instances that may have missed
-- some database updates. The script is intentionally idempotent and can be
-- rerun after partial success.
--
-- Assumption: the base schema from 1_template.sql already exists.

begin;

-- =========================================================
-- Instance settings + announcements
-- =========================================================

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references public.users(id),
  updated_at timestamp with time zone not null default now()
);

alter table public.app_settings
  add column if not exists value jsonb default '{}'::jsonb,
  add column if not exists updated_by uuid references public.users(id),
  add column if not exists updated_at timestamp with time zone default now();

update public.app_settings
set
  value = coalesce(value, '{}'::jsonb),
  updated_at = coalesce(updated_at, now());

alter table public.app_settings
  alter column value set default '{}'::jsonb,
  alter column value set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

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
  severity text not null default 'info',
  is_active boolean not null default true,
  starts_at timestamp with time zone,
  ends_at timestamp with time zone,
  created_by uuid references public.users(id),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table public.announcements
  add column if not exists title text,
  add column if not exists message text,
  add column if not exists image_url text,
  add column if not exists severity text default 'info',
  add column if not exists is_active boolean default true,
  add column if not exists starts_at timestamp with time zone,
  add column if not exists ends_at timestamp with time zone,
  add column if not exists created_by uuid references public.users(id),
  add column if not exists created_at timestamp with time zone default now(),
  add column if not exists updated_at timestamp with time zone default now();

update public.announcements
set
  title = coalesce(title, 'Migrated announcement'),
  message = coalesce(message, ''),
  severity = coalesce(severity, 'info'),
  is_active = coalesce(is_active, true),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now());

alter table public.announcements
  alter column title set not null,
  alter column message set not null,
  alter column severity set default 'info',
  alter column severity set not null,
  alter column is_active set default true,
  alter column is_active set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

alter table public.announcements
  drop constraint if exists announcements_severity_check;

alter table public.announcements
  add constraint announcements_severity_check
  check (severity in ('info', 'warning', 'urgent'));

create index if not exists idx_announcements_active_dates
on public.announcements(is_active, starts_at, ends_at);

insert into storage.buckets (id, name, public)
values ('announcement-images', 'announcement-images', true)
on conflict (id) do update
set public = true;

create table if not exists public.policy_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category text,
  file_url text not null,
  file_name text not null,
  file_size bigint,
  storage_path text,
  is_active boolean not null default true,
  created_by uuid references public.users(id),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table public.policy_documents
  add column if not exists title text,
  add column if not exists description text,
  add column if not exists category text,
  add column if not exists file_url text,
  add column if not exists file_name text,
  add column if not exists file_size bigint,
  add column if not exists storage_path text,
  add column if not exists is_active boolean default true,
  add column if not exists created_by uuid references public.users(id),
  add column if not exists created_at timestamp with time zone default now(),
  add column if not exists updated_at timestamp with time zone default now();

update public.policy_documents
set
  title = coalesce(title, 'Policy document'),
  file_url = coalesce(file_url, ''),
  file_name = coalesce(file_name, 'document.pdf'),
  is_active = coalesce(is_active, true),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now());

alter table public.policy_documents
  alter column title set not null,
  alter column file_url set not null,
  alter column file_name set not null,
  alter column is_active set default true,
  alter column is_active set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

create index if not exists idx_policy_documents_active_updated
on public.policy_documents(is_active, updated_at desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'policy-documents',
  'policy-documents',
  true,
  20971520,
  array['application/pdf']::text[]
)
on conflict (id) do update
set
  public = true,
  file_size_limit = 20971520,
  allowed_mime_types = array['application/pdf']::text[];

-- =========================================================
-- Manual attendance + attendance adjustment requests
-- =========================================================

alter table public.attendance
  add column if not exists entry_mode text not null default 'self',
  add column if not exists manual_reason text,
  add column if not exists created_by uuid references public.users(id),
  add column if not exists updated_by uuid references public.users(id),
  add column if not exists updated_at timestamp with time zone default now(),
  add column if not exists activity_log_submitted boolean not null default false,
  add column if not exists activity_log_submitted_at timestamp with time zone;

update public.attendance
set
  entry_mode = coalesce(entry_mode, 'self'),
  activity_log_submitted = coalesce(activity_log_submitted, false);

alter table public.attendance
  alter column entry_mode set default 'self',
  alter column entry_mode set not null,
  alter column activity_log_submitted set default false,
  alter column activity_log_submitted set not null;

alter table public.attendance
  drop constraint if exists attendance_entry_mode_check;

alter table public.attendance
  add constraint attendance_entry_mode_check
  check (entry_mode in ('self', 'manual', 'adjusted'));

do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'attendance_user_date_unique'
  ) then
    if exists (
      select 1
      from public.attendance
      where user_id is not null
        and date is not null
      group by user_id, date
      having count(*) > 1
    ) then
      raise notice 'Skipped attendance_user_date_unique because duplicate user/date attendance rows exist.';
    else
      create unique index attendance_user_date_unique
      on public.attendance(user_id, date);
    end if;
  end if;
end $$;

create table if not exists public.attendance_adjustments (
  id uuid primary key default gen_random_uuid(),
  attendance_id uuid not null references public.attendance(id) on delete cascade,
  user_id uuid not null references public.users(id),
  request_type text not null default 'punch_alteration',
  status text not null default 'pending',
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

alter table public.attendance_adjustments
  add column if not exists attendance_id uuid references public.attendance(id) on delete cascade,
  add column if not exists user_id uuid references public.users(id),
  add column if not exists request_type text default 'punch_alteration',
  add column if not exists status text default 'pending',
  add column if not exists previous_clock_in timestamp with time zone,
  add column if not exists previous_clock_out timestamp with time zone,
  add column if not exists requested_clock_in timestamp with time zone,
  add column if not exists requested_clock_out timestamp with time zone,
  add column if not exists request_reason text,
  add column if not exists approved_clock_in timestamp with time zone,
  add column if not exists approved_clock_out timestamp with time zone,
  add column if not exists admin_remarks text,
  add column if not exists created_by uuid references public.users(id),
  add column if not exists reviewed_by uuid references public.users(id),
  add column if not exists created_at timestamp with time zone default now(),
  add column if not exists reviewed_at timestamp with time zone;

update public.attendance_adjustments
set
  request_type = coalesce(request_type, 'punch_alteration'),
  status = coalesce(status, 'pending'),
  request_reason = coalesce(request_reason, 'Migrated attendance adjustment request'),
  created_by = coalesce(created_by, user_id),
  created_at = coalesce(created_at, now());

alter table public.attendance_adjustments
  alter column request_type set default 'punch_alteration',
  alter column request_type set not null,
  alter column status set default 'pending',
  alter column status set not null,
  alter column request_reason set not null,
  alter column created_at set default now(),
  alter column created_at set not null;

alter table public.attendance_adjustments
  drop constraint if exists attendance_adjustments_request_type_check;

alter table public.attendance_adjustments
  add constraint attendance_adjustments_request_type_check
  check (request_type in ('punch_alteration'));

alter table public.attendance_adjustments
  drop constraint if exists attendance_adjustments_status_check;

alter table public.attendance_adjustments
  add constraint attendance_adjustments_status_check
  check (status in ('pending', 'approved', 'rejected', 'cancelled'));

create index if not exists idx_attendance_adjustments_attendance_id
on public.attendance_adjustments(attendance_id);

create index if not exists idx_attendance_adjustments_user_id
on public.attendance_adjustments(user_id);

create index if not exists idx_attendance_adjustments_status
on public.attendance_adjustments(status);

-- =========================================================
-- Shift activity-log requirement + attendance activity logs
-- =========================================================

alter table public.shifts
  add column if not exists require_activity_log_before_clock_out boolean not null default false,
  add column if not exists activity_log_label text,
  add column if not exists min_activity_entries integer not null default 1;

update public.shifts
set
  require_activity_log_before_clock_out = coalesce(require_activity_log_before_clock_out, false),
  min_activity_entries = coalesce(min_activity_entries, 1);

alter table public.shifts
  alter column require_activity_log_before_clock_out set default false,
  alter column require_activity_log_before_clock_out set not null,
  alter column min_activity_entries set default 1,
  alter column min_activity_entries set not null;

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

alter table public.attendance_activity_logs
  add column if not exists attendance_id uuid references public.attendance(id) on delete cascade,
  add column if not exists user_id uuid references public.users(id),
  add column if not exists activity_text text,
  add column if not exists activity_order integer default 1,
  add column if not exists hours_spent numeric,
  add column if not exists output_note text,
  add column if not exists created_at timestamp with time zone default now(),
  add column if not exists updated_at timestamp with time zone default now();

update public.attendance_activity_logs
set
  activity_text = coalesce(activity_text, 'Migrated activity log'),
  activity_order = coalesce(activity_order, 1),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now());

alter table public.attendance_activity_logs
  alter column activity_text set not null,
  alter column activity_order set default 1,
  alter column activity_order set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

create index if not exists idx_attendance_activity_logs_attendance_id
on public.attendance_activity_logs(attendance_id);

create index if not exists idx_attendance_activity_logs_user_id
on public.attendance_activity_logs(user_id);

-- =========================================================
-- Leave/payroll fields for paid leave and part-time payroll
-- =========================================================

alter table public.leave_types
  add column if not exists is_paid boolean default true,
  add column if not exists counts_for_payroll boolean default true;

update public.leave_types
set
  is_paid = coalesce(is_paid, true),
  counts_for_payroll = coalesce(counts_for_payroll, true);

alter table public.leave_types
  alter column is_paid set default true,
  alter column is_paid set not null,
  alter column counts_for_payroll set default true,
  alter column counts_for_payroll set not null;

alter table public.employee_recurring_deductions
  add column if not exists adjustment_type text default 'deduction';

update public.employee_recurring_deductions
set adjustment_type = coalesce(adjustment_type, 'deduction');

alter table public.employee_recurring_deductions
  alter column adjustment_type set default 'deduction',
  alter column adjustment_type set not null;

alter table public.employee_recurring_deductions
  drop constraint if exists employee_recurring_deductions_adjustment_type_check;

alter table public.employee_recurring_deductions
  add constraint employee_recurring_deductions_adjustment_type_check
  check (adjustment_type = any (array['addition'::text, 'deduction'::text]));

alter table public.employee_compensation
  add column if not exists employment_type text default 'regular',
  add column if not exists unpaid_break_minutes integer default 60;

update public.employee_compensation
set
  employment_type = coalesce(employment_type, 'regular'),
  unpaid_break_minutes = coalesce(unpaid_break_minutes, 60);

alter table public.employee_compensation
  alter column employment_type set default 'regular',
  alter column employment_type set not null,
  alter column unpaid_break_minutes set default 60,
  alter column unpaid_break_minutes set not null;

alter table public.employee_compensation
  drop constraint if exists employee_compensation_employment_type_check;

alter table public.employee_compensation
  add constraint employee_compensation_employment_type_check
  check (employment_type = any (array['regular'::text, 'part_time'::text]));

alter table public.payroll_records
  add column if not exists employment_type text default 'regular',
  add column if not exists unpaid_break_minutes integer default 60,
  add column if not exists total_work_minutes integer default 0;

update public.payroll_records
set
  employment_type = coalesce(employment_type, 'regular'),
  unpaid_break_minutes = coalesce(unpaid_break_minutes, 60),
  total_work_minutes = coalesce(total_work_minutes, 0);

alter table public.payroll_records
  alter column employment_type set default 'regular',
  alter column employment_type set not null,
  alter column unpaid_break_minutes set default 60,
  alter column unpaid_break_minutes set not null,
  alter column total_work_minutes set default 0,
  alter column total_work_minutes set not null;

alter table public.payroll_records
  drop constraint if exists payroll_records_employment_type_check;

alter table public.payroll_records
  add constraint payroll_records_employment_type_check
  check (employment_type = any (array['regular'::text, 'part_time'::text]));

-- =========================================================
-- Date-specific shift change requests
-- =========================================================

create table if not exists public.shift_change_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  request_date date not null,
  requested_shift_id uuid not null references public.shifts(id),
  status text not null default 'pending',
  request_reason text not null,
  admin_remarks text,
  created_by uuid not null references public.users(id),
  reviewed_by uuid references public.users(id),
  created_at timestamp with time zone not null default now(),
  reviewed_at timestamp with time zone,
  updated_at timestamp with time zone not null default now()
);

alter table public.shift_change_requests
  add column if not exists user_id uuid references public.users(id),
  add column if not exists request_date date,
  add column if not exists requested_shift_id uuid references public.shifts(id),
  add column if not exists status text default 'pending',
  add column if not exists request_reason text,
  add column if not exists admin_remarks text,
  add column if not exists created_by uuid references public.users(id),
  add column if not exists reviewed_by uuid references public.users(id),
  add column if not exists created_at timestamp with time zone default now(),
  add column if not exists reviewed_at timestamp with time zone,
  add column if not exists updated_at timestamp with time zone default now();

update public.shift_change_requests
set
  status = coalesce(status, 'pending'),
  request_reason = coalesce(request_reason, 'Migrated shift change request'),
  created_by = coalesce(created_by, user_id),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now());

alter table public.shift_change_requests
  alter column status set default 'pending',
  alter column status set not null,
  alter column request_reason set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

alter table public.shift_change_requests
  drop constraint if exists shift_change_requests_status_check;

alter table public.shift_change_requests
  add constraint shift_change_requests_status_check
  check (status in ('pending', 'approved', 'rejected', 'cancelled'));

create index if not exists idx_shift_change_requests_user_date
on public.shift_change_requests(user_id, request_date);

create index if not exists idx_shift_change_requests_status
on public.shift_change_requests(status);

do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'idx_shift_change_requests_one_active_per_day'
  ) then
    if exists (
      select 1
      from public.shift_change_requests
      where status in ('pending', 'approved')
        and user_id is not null
        and request_date is not null
      group by user_id, request_date
      having count(*) > 1
    ) then
      raise notice 'Skipped idx_shift_change_requests_one_active_per_day because duplicate active shift-change requests exist.';
    else
      create unique index idx_shift_change_requests_one_active_per_day
      on public.shift_change_requests(user_id, request_date)
      where status in ('pending', 'approved');
    end if;
  end if;
end $$;

-- =========================================================
-- RLS policies
-- =========================================================

alter table public.attendance_adjustments enable row level security;
alter table public.attendance_activity_logs enable row level security;
alter table public.employee_compensation enable row level security;
alter table public.payroll_adjustments enable row level security;
alter table public.employee_recurring_deductions enable row level security;
alter table public.user_rest_days enable row level security;
alter table public.shift_change_requests enable row level security;
alter table public.app_settings enable row level security;
alter table public.announcements enable row level security;

-- Attendance adjustments
drop policy if exists "Staff can view attendance adjustments" on public.attendance_adjustments;
drop policy if exists "Staff can insert attendance adjustments" on public.attendance_adjustments;
drop policy if exists "Staff can update attendance adjustments" on public.attendance_adjustments;
drop policy if exists "Staff can delete attendance adjustments" on public.attendance_adjustments;
drop policy if exists "Users can view own attendance adjustments" on public.attendance_adjustments;
drop policy if exists "Users can insert own attendance adjustments" on public.attendance_adjustments;
drop policy if exists "Users can update own attendance adjustments" on public.attendance_adjustments;
drop policy if exists "Users can delete own attendance adjustments" on public.attendance_adjustments;

create policy "Staff can view attendance adjustments"
on public.attendance_adjustments for select to authenticated
using (exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin', 'hr', 'payroll')));

create policy "Staff can insert attendance adjustments"
on public.attendance_adjustments for insert to authenticated
with check (exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin', 'hr', 'payroll')));

create policy "Staff can update attendance adjustments"
on public.attendance_adjustments for update to authenticated
using (exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin', 'hr', 'payroll')))
with check (exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin', 'hr', 'payroll')));

create policy "Staff can delete attendance adjustments"
on public.attendance_adjustments for delete to authenticated
using (exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin', 'hr', 'payroll')));

create policy "Users can view own attendance adjustments"
on public.attendance_adjustments for select to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own attendance adjustments"
on public.attendance_adjustments for insert to authenticated
with check (auth.uid() = user_id and auth.uid() = created_by);

create policy "Users can update own attendance adjustments"
on public.attendance_adjustments for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own attendance adjustments"
on public.attendance_adjustments for delete to authenticated
using (auth.uid() = user_id);

-- Attendance activity logs
drop policy if exists "Staff can view attendance activity logs" on public.attendance_activity_logs;
drop policy if exists "Staff can insert attendance activity logs" on public.attendance_activity_logs;
drop policy if exists "Staff can update attendance activity logs" on public.attendance_activity_logs;
drop policy if exists "Staff can delete attendance activity logs" on public.attendance_activity_logs;
drop policy if exists "Users can view own attendance activity logs" on public.attendance_activity_logs;
drop policy if exists "Users can insert own attendance activity logs" on public.attendance_activity_logs;
drop policy if exists "Users can update own attendance activity logs" on public.attendance_activity_logs;
drop policy if exists "Users can delete own attendance activity logs" on public.attendance_activity_logs;

create policy "Staff can view attendance activity logs"
on public.attendance_activity_logs for select to authenticated
using (exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin', 'hr', 'payroll')));

create policy "Staff can insert attendance activity logs"
on public.attendance_activity_logs for insert to authenticated
with check (exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin', 'hr', 'payroll')));

create policy "Staff can update attendance activity logs"
on public.attendance_activity_logs for update to authenticated
using (exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin', 'hr', 'payroll')))
with check (exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin', 'hr', 'payroll')));

create policy "Staff can delete attendance activity logs"
on public.attendance_activity_logs for delete to authenticated
using (exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin', 'hr', 'payroll')));

create policy "Users can view own attendance activity logs"
on public.attendance_activity_logs for select to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own attendance activity logs"
on public.attendance_activity_logs for insert to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own attendance activity logs"
on public.attendance_activity_logs for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own attendance activity logs"
on public.attendance_activity_logs for delete to authenticated
using (auth.uid() = user_id);

-- Employee compensation
drop policy if exists "Staff can view employee compensation" on public.employee_compensation;
drop policy if exists "Staff can insert employee compensation" on public.employee_compensation;
drop policy if exists "Staff can update employee compensation" on public.employee_compensation;
drop policy if exists "Staff can delete employee compensation" on public.employee_compensation;
drop policy if exists "Users can view own employee compensation" on public.employee_compensation;

create policy "Staff can view employee compensation"
on public.employee_compensation for select to authenticated
using (exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin', 'hr', 'payroll')));

create policy "Staff can insert employee compensation"
on public.employee_compensation for insert to authenticated
with check (exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin', 'hr', 'payroll')));

create policy "Staff can update employee compensation"
on public.employee_compensation for update to authenticated
using (exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin', 'hr', 'payroll')))
with check (exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin', 'hr', 'payroll')));

create policy "Staff can delete employee compensation"
on public.employee_compensation for delete to authenticated
using (exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin', 'hr', 'payroll')));

create policy "Users can view own employee compensation"
on public.employee_compensation for select to authenticated
using (user_id = auth.uid());

-- Payroll adjustments
drop policy if exists "Staff can view payroll adjustments" on public.payroll_adjustments;
drop policy if exists "Staff can insert payroll adjustments" on public.payroll_adjustments;
drop policy if exists "Staff can update payroll adjustments" on public.payroll_adjustments;
drop policy if exists "Staff can delete payroll adjustments" on public.payroll_adjustments;
drop policy if exists "Users can view own payroll adjustments" on public.payroll_adjustments;

create policy "Staff can view payroll adjustments"
on public.payroll_adjustments for select to authenticated
using (exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin', 'hr', 'payroll')));

create policy "Staff can insert payroll adjustments"
on public.payroll_adjustments for insert to authenticated
with check (exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin', 'hr', 'payroll')));

create policy "Staff can update payroll adjustments"
on public.payroll_adjustments for update to authenticated
using (exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin', 'hr', 'payroll')))
with check (exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin', 'hr', 'payroll')));

create policy "Staff can delete payroll adjustments"
on public.payroll_adjustments for delete to authenticated
using (exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin', 'hr', 'payroll')));

create policy "Users can view own payroll adjustments"
on public.payroll_adjustments for select to authenticated
using (user_id = auth.uid());

-- Recurring payroll items
drop policy if exists "Staff can view recurring payroll items" on public.employee_recurring_deductions;
drop policy if exists "Staff can insert recurring payroll items" on public.employee_recurring_deductions;
drop policy if exists "Staff can update recurring payroll items" on public.employee_recurring_deductions;
drop policy if exists "Staff can delete recurring payroll items" on public.employee_recurring_deductions;
drop policy if exists "Users can view own recurring payroll items" on public.employee_recurring_deductions;

create policy "Staff can view recurring payroll items"
on public.employee_recurring_deductions for select to authenticated
using (exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin', 'hr', 'payroll')));

create policy "Staff can insert recurring payroll items"
on public.employee_recurring_deductions for insert to authenticated
with check (exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin', 'hr', 'payroll')));

create policy "Staff can update recurring payroll items"
on public.employee_recurring_deductions for update to authenticated
using (exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin', 'hr', 'payroll')))
with check (exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin', 'hr', 'payroll')));

create policy "Staff can delete recurring payroll items"
on public.employee_recurring_deductions for delete to authenticated
using (exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin', 'hr', 'payroll')));

create policy "Users can view own recurring payroll items"
on public.employee_recurring_deductions for select to authenticated
using (user_id = auth.uid());

-- User rest days
drop policy if exists "Staff can manage user rest days" on public.user_rest_days;
drop policy if exists "Users can view own rest days" on public.user_rest_days;

create policy "Staff can manage user rest days"
on public.user_rest_days for all to authenticated
using (exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin', 'hr', 'payroll')))
with check (exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin', 'hr', 'payroll')));

create policy "Users can view own rest days"
on public.user_rest_days for select to authenticated
using (auth.uid() = user_id);

-- Shift change requests
drop policy if exists "Users can view own shift change requests" on public.shift_change_requests;
drop policy if exists "Users can create own shift change requests" on public.shift_change_requests;
drop policy if exists "Staff can view shift change requests" on public.shift_change_requests;
drop policy if exists "Staff can update shift change requests" on public.shift_change_requests;

create policy "Users can view own shift change requests"
on public.shift_change_requests for select to authenticated
using (auth.uid() = user_id);

create policy "Users can create own shift change requests"
on public.shift_change_requests for insert to authenticated
with check (auth.uid() = user_id and auth.uid() = created_by and status = 'pending');

create policy "Staff can view shift change requests"
on public.shift_change_requests for select to authenticated
using (exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin', 'hr', 'payroll')));

create policy "Staff can update shift change requests"
on public.shift_change_requests for update to authenticated
using (exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin', 'hr', 'payroll')))
with check (exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin', 'hr', 'payroll')));

-- App settings
drop policy if exists "Authenticated users can read app settings" on public.app_settings;
drop policy if exists "Staff can manage app settings" on public.app_settings;

create policy "Authenticated users can read app settings"
on public.app_settings for select to authenticated
using (true);

create policy "Staff can manage app settings"
on public.app_settings for all to authenticated
using (exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin', 'hr', 'payroll')))
with check (exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin', 'hr', 'payroll')));

-- Announcements
drop policy if exists "Authenticated users can view active announcements" on public.announcements;
drop policy if exists "Staff can manage announcements" on public.announcements;
drop policy if exists "Public can view announcement images" on storage.objects;
drop policy if exists "Staff can upload announcement images" on storage.objects;
drop policy if exists "Staff can update announcement images" on storage.objects;
drop policy if exists "Staff can delete announcement images" on storage.objects;

create policy "Authenticated users can view active announcements"
on public.announcements for select to authenticated
using (
  is_active = true
  and (starts_at is null or starts_at <= now())
  and (ends_at is null or ends_at >= now())
);

create policy "Staff can manage announcements"
on public.announcements for all to authenticated
using (exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin', 'hr', 'payroll')))
with check (exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin', 'hr', 'payroll')));

create policy "Public can view announcement images"
on storage.objects for select to public
using (bucket_id = 'announcement-images');

create policy "Staff can upload announcement images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'announcement-images'
  and exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin', 'hr', 'payroll'))
);

create policy "Staff can update announcement images"
on storage.objects for update to authenticated
using (
  bucket_id = 'announcement-images'
  and exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin', 'hr', 'payroll'))
)
with check (
  bucket_id = 'announcement-images'
  and exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin', 'hr', 'payroll'))
);

create policy "Staff can delete announcement images"
on storage.objects for delete to authenticated
using (
  bucket_id = 'announcement-images'
  and exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin', 'hr', 'payroll'))
);

-- Corporate policy documents
alter table public.policy_documents enable row level security;

drop policy if exists "Authenticated users can view active policy documents" on public.policy_documents;
drop policy if exists "Staff can manage policy documents" on public.policy_documents;
drop policy if exists "Public can view policy PDFs" on storage.objects;
drop policy if exists "Staff can upload policy PDFs" on storage.objects;
drop policy if exists "Staff can update policy PDFs" on storage.objects;
drop policy if exists "Staff can delete policy PDFs" on storage.objects;

create policy "Authenticated users can view active policy documents"
on public.policy_documents for select to authenticated
using (is_active = true);

create policy "Staff can manage policy documents"
on public.policy_documents for all to authenticated
using (exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin', 'hr', 'payroll')))
with check (exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin', 'hr', 'payroll')));

create policy "Public can view policy PDFs"
on storage.objects for select to public
using (bucket_id = 'policy-documents');

create policy "Staff can upload policy PDFs"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'policy-documents'
  and exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin', 'hr', 'payroll'))
);

create policy "Staff can update policy PDFs"
on storage.objects for update to authenticated
using (
  bucket_id = 'policy-documents'
  and exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin', 'hr', 'payroll'))
)
with check (
  bucket_id = 'policy-documents'
  and exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin', 'hr', 'payroll'))
);

create policy "Staff can delete policy PDFs"
on storage.objects for delete to authenticated
using (
  bucket_id = 'policy-documents'
  and exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin', 'hr', 'payroll'))
);

-- =========================================================
-- Government contribution controls and payroll snapshots
-- =========================================================

alter table public.employee_compensation
  add column if not exists deduct_sss boolean not null default true,
  add column if not exists deduct_philhealth boolean not null default true,
  add column if not exists deduct_pagibig boolean not null default true,
  add column if not exists deduct_withholding_tax boolean not null default false,
  add column if not exists government_contribution_frequency text not null default 'monthly_second_half';

alter table public.employee_compensation
  drop constraint if exists employee_compensation_government_contribution_frequency_check;

alter table public.employee_compensation
  add constraint employee_compensation_government_contribution_frequency_check
  check (government_contribution_frequency = any (array[
    'every_payroll'::text,
    'monthly_first_half'::text,
    'monthly_second_half'::text
  ]));

alter table public.payroll_records
  add column if not exists sss_employer_contribution numeric not null default 0,
  add column if not exists pagibig_employer_contribution numeric not null default 0,
  add column if not exists philhealth_employer_contribution numeric not null default 0,
  add column if not exists sss_monthly_salary_credit numeric not null default 0,
  add column if not exists pagibig_monthly_salary_base numeric not null default 0,
  add column if not exists philhealth_monthly_salary_base numeric not null default 0;

create table if not exists public.government_contribution_settings (
  id uuid primary key default gen_random_uuid(),
  setting_type text not null
    check (setting_type = any (array[
      'sss'::text,
      'philhealth'::text,
      'pagibig'::text,
      'withholding_tax'::text
    ])),
  name text not null,
  effective_from date not null default current_date,
  is_active boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists idx_government_contribution_settings_type
  on public.government_contribution_settings(setting_type);

create index if not exists idx_government_contribution_settings_active
  on public.government_contribution_settings(is_active);

alter table public.government_contribution_settings enable row level security;

drop policy if exists "Staff can view government contribution settings"
  on public.government_contribution_settings;
drop policy if exists "Staff can insert government contribution settings"
  on public.government_contribution_settings;
drop policy if exists "Staff can update government contribution settings"
  on public.government_contribution_settings;
drop policy if exists "Staff can delete government contribution settings"
  on public.government_contribution_settings;

create policy "Staff can view government contribution settings"
on public.government_contribution_settings for select to authenticated
using (exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin', 'hr', 'payroll')));

create policy "Staff can insert government contribution settings"
on public.government_contribution_settings for insert to authenticated
with check (exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin', 'hr', 'payroll')));

create policy "Staff can update government contribution settings"
on public.government_contribution_settings for update to authenticated
using (exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin', 'hr', 'payroll')))
with check (exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin', 'hr', 'payroll')));

create policy "Staff can delete government contribution settings"
on public.government_contribution_settings for delete to authenticated
using (exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin', 'hr', 'payroll')));

-- =========================================================
-- Digital 201 file management
-- =========================================================

insert into storage.buckets (id, name, public)
values ('employee-201-files', 'employee-201-files', false)
on conflict (id) do update set public = false;

create table if not exists public.document_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.document_requirements (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.document_categories(id) on delete set null,
  name text not null,
  description text,
  is_required boolean not null default true,
  requires_expiry boolean not null default false,
  employee_upload_allowed boolean not null default false,
  employment_type text not null default 'all'
    check (employment_type = any (array['all'::text, 'regular'::text, 'part_time'::text])),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.employee_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  category_id uuid references public.document_categories(id) on delete set null,
  requirement_id uuid references public.document_requirements(id) on delete set null,
  title text not null,
  file_name text not null,
  file_size bigint,
  mime_type text,
  storage_path text not null,
  status text not null default 'submitted'
    check (status = any (array['submitted'::text, 'verified'::text, 'rejected'::text, 'expired'::text])),
  expiry_date date,
  remarks text,
  uploaded_by uuid references public.users(id) on delete set null,
  verified_by uuid references public.users(id) on delete set null,
  verified_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.employee_document_activity_logs (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references public.employee_documents(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  action text not null,
  actor_id uuid references public.users(id) on delete set null,
  notes text,
  created_at timestamp with time zone not null default now()
);

create index if not exists idx_document_categories_active on public.document_categories(is_active);
create index if not exists idx_document_requirements_active on public.document_requirements(is_active);
create index if not exists idx_employee_documents_user_id on public.employee_documents(user_id);
create index if not exists idx_employee_documents_requirement_id on public.employee_documents(requirement_id);
create index if not exists idx_employee_documents_status on public.employee_documents(status);
create index if not exists idx_employee_documents_expiry_date on public.employee_documents(expiry_date);
create index if not exists idx_employee_document_activity_document_id on public.employee_document_activity_logs(document_id);

alter table public.document_categories enable row level security;
alter table public.document_requirements enable row level security;
alter table public.employee_documents enable row level security;
alter table public.employee_document_activity_logs enable row level security;

drop policy if exists "Staff can manage document categories" on public.document_categories;
drop policy if exists "Staff can manage document requirements" on public.document_requirements;
drop policy if exists "Staff can manage employee documents" on public.employee_documents;
drop policy if exists "Users can view own employee documents" on public.employee_documents;
drop policy if exists "Staff can view document activity logs" on public.employee_document_activity_logs;
drop policy if exists "Staff can insert document activity logs" on public.employee_document_activity_logs;

create policy "Staff can manage document categories"
on public.document_categories for all to authenticated
using (exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin', 'hr')))
with check (exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin', 'hr')));

create policy "Staff can manage document requirements"
on public.document_requirements for all to authenticated
using (exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin', 'hr')))
with check (exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin', 'hr')));

create policy "Staff can manage employee documents"
on public.employee_documents for all to authenticated
using (exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin', 'hr')))
with check (exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin', 'hr')));

create policy "Users can view own employee documents"
on public.employee_documents for select to authenticated
using (user_id = auth.uid());

create policy "Staff can view document activity logs"
on public.employee_document_activity_logs for select to authenticated
using (exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin', 'hr')));

create policy "Staff can insert document activity logs"
on public.employee_document_activity_logs for insert to authenticated
with check (exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin', 'hr')));

drop policy if exists "Staff can upload employee 201 files" on storage.objects;
drop policy if exists "Staff can view employee 201 files" on storage.objects;
drop policy if exists "Staff can update employee 201 files" on storage.objects;
drop policy if exists "Staff can delete employee 201 files" on storage.objects;

create policy "Staff can upload employee 201 files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'employee-201-files'
  and exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin', 'hr'))
);

create policy "Staff can view employee 201 files"
on storage.objects for select to authenticated
using (
  bucket_id = 'employee-201-files'
  and exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin', 'hr'))
);

create policy "Staff can update employee 201 files"
on storage.objects for update to authenticated
using (
  bucket_id = 'employee-201-files'
  and exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin', 'hr'))
)
with check (
  bucket_id = 'employee-201-files'
  and exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin', 'hr'))
);

create policy "Staff can delete employee 201 files"
on storage.objects for delete to authenticated
using (
  bucket_id = 'employee-201-files'
  and exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('admin', 'hr'))
);

commit;
