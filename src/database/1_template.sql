-- =========================================================
-- HRIS / Attendance Monitoring System Schema
-- Clean executable version for a fresh Supabase project
-- =========================================================

create extension if not exists pgcrypto;

-- =========================================================
-- 1) MASTER TABLES
-- =========================================================

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_at timestamp without time zone default now()
);

create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  latitude numeric,
  longitude numeric,
  created_at timestamp without time zone default now()
);

create table if not exists public.leave_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  requires_attachment boolean not null default false,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  is_paid boolean not null default true,
  counts_for_payroll boolean not null default true
);

create table if not exists public.payroll_periods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  date_from date not null,
  date_to date not null,
  pay_date date,
  status text not null default 'draft'
    check (status = any (array[
      'draft'::text,
      'processing'::text,
      'processed'::text,
      'finalized'::text,
      'released'::text
    ])),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.payroll_settings (
  id uuid primary key default gen_random_uuid(),
  company_name text,
  default_working_days_per_month integer not null default 22,
  default_hours_per_day numeric not null default 8,
  overtime_multiplier_regular numeric not null default 1.25,
  overtime_multiplier_restday numeric not null default 1.30,
  overtime_multiplier_holiday numeric not null default 2.00,
  restday_multiplier numeric not null default 1.30,
  holiday_multiplier numeric not null default 2.00,
  holiday_restday_multiplier numeric not null default 2.60,
  late_deduction_basis text not null default 'hourly_rate'
    check (late_deduction_basis = any (array[
      'hourly_rate'::text,
      'daily_rate_fraction'::text,
      'custom'::text
    ])),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  company_logo_url text,
  company_address text,
  company_tin text
);

create table if not exists public.shifts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location_id uuid,
  start_time time without time zone not null,
  end_time time without time zone not null,
  grace_minutes integer not null default 0,
  overtime_after_minutes integer not null default 0,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  constraint shifts_location_id_fkey
    foreign key (location_id) references public.locations(id)
);

-- =========================================================
-- 2) USERS
-- =========================================================

create table if not exists public.users (
  id uuid primary key,
  name text,
  email text,
  department text,
  role text default 'user'::text,
  sss text,
  pagibig text,
  philhealth text,
  atm_number text,
  created_at timestamp without time zone default now(),
  shift_id uuid,
  department_id uuid,
  constraint users_id_fkey
    foreign key (id) references auth.users(id),
  constraint users_shift_id_fkey
    foreign key (shift_id) references public.shifts(id),
  constraint users_department_id_fkey
    foreign key (department_id) references public.departments(id)
);

-- =========================================================
-- 3) ATTENDANCE / HOLIDAYS / REST DAYS
-- =========================================================

create table if not exists public.holidays (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  holiday_date date not null,
  type text not null default 'regular'::text,
  description text,
  is_paid boolean not null default true,
  location_id uuid,
  created_at timestamp with time zone not null default now(),
  constraint holidays_location_id_fkey
    foreign key (location_id) references public.locations(id)
);

create table if not exists public.user_rest_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  day_of_week text not null,
  effective_from date not null,
  effective_to date,
  created_at timestamp with time zone not null default now(),
  constraint user_rest_days_user_id_fkey
    foreign key (user_id) references public.users(id)
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  clock_in timestamp with time zone default now(),
  clock_out timestamp with time zone,
  date date,
  status text default 'present'::text,
  location_id uuid,
  created_at timestamp with time zone default now(),
  shift_id uuid,
  scheduled_start timestamp with time zone,
  scheduled_end timestamp with time zone,
  minutes_late integer default 0,
  minutes_overtime integer default 0,
  is_late boolean not null default false,
  is_overtime boolean not null default false,
  is_absent boolean not null default false,
  remarks text,
  approved_overtime_minutes integer default 0,
  overtime_status text default 'pending'::text,
  is_holiday boolean not null default false,
  is_restday boolean not null default false,
  holiday_name text,
  constraint attendance_user_id_fkey
    foreign key (user_id) references public.users(id),
  constraint attendance_location_id_fkey
    foreign key (location_id) references public.locations(id),
  constraint attendance_shift_id_fkey
    foreign key (shift_id) references public.shifts(id)
);

-- =========================================================
-- 4) LEAVE MANAGEMENT
-- =========================================================

create table if not exists public.leave_balances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  leave_type_id uuid not null,
  year integer not null,
  entitled numeric not null default 0,
  used numeric not null default 0,
  pending numeric not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint leave_balances_user_id_fkey
    foreign key (user_id) references public.users(id),
  constraint leave_balances_leave_type_id_fkey
    foreign key (leave_type_id) references public.leave_types(id)
);

create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  leave_type_id uuid not null,
  date_from date not null,
  date_to date not null,
  is_half_day boolean not null default false,
  half_day_portion text
    check (half_day_portion = any (array['AM'::text, 'PM'::text])),
  total_days numeric not null default 0.0,
  reason text,
  attachment_url text,
  status text not null default 'pending'::text
    check (status = any (array[
      'pending'::text,
      'approved'::text,
      'rejected'::text,
      'cancelled'::text
    ])),
  approver_id uuid,
  approver_remarks text,
  approved_at timestamp with time zone,
  rejected_at timestamp with time zone,
  cancelled_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint leave_requests_user_id_fkey
    foreign key (user_id) references public.users(id),
  constraint leave_requests_leave_type_id_fkey
    foreign key (leave_type_id) references public.leave_types(id),
  constraint leave_requests_approver_id_fkey
    foreign key (approver_id) references public.users(id)
);

create table if not exists public.leave_request_dates (
  id uuid primary key default gen_random_uuid(),
  leave_request_id uuid not null,
  leave_date date not null,
  day_value numeric not null default 1.0,
  created_at timestamp with time zone not null default now(),
  constraint leave_request_dates_leave_request_id_fkey
    foreign key (leave_request_id) references public.leave_requests(id)
);

-- =========================================================
-- 5) COMPENSATION / DEDUCTIONS
-- =========================================================

create table if not exists public.employee_compensation (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  pay_type text not null
    check (pay_type = any (array[
      'monthly'::text,
      'daily'::text,
      'hourly'::text
    ])),
  basic_monthly_rate numeric default 0,
  daily_rate numeric default 0,
  hourly_rate numeric default 0,
  allowance_amount numeric not null default 0,
  overtime_hourly_rate numeric default 0,
  late_deduction_mode text not null default 'per_minute'::text
    check (late_deduction_mode = any (array[
      'none'::text,
      'per_minute'::text,
      'per_hour'::text,
      'fixed'::text
    ])),
  late_deduction_rate numeric not null default 0,
  undertime_deduction_rate numeric not null default 0,
  absent_deduction_rate numeric not null default 0,
  effective_from date not null,
  effective_to date,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint employee_compensation_user_id_fkey
    foreign key (user_id) references public.users(id)
);

create table if not exists public.employee_recurring_deductions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  amount numeric not null default 0,
  deduction_type text not null default 'fixed'::text
    check (deduction_type = any (array[
      'fixed'::text,
      'percentage'::text
    ])),
  frequency text not null default 'every_payroll'::text
    check (frequency = any (array[
      'every_payroll'::text,
      'monthly_first_half'::text,
      'monthly_second_half'::text,
      'one_time'::text
    ])),
  start_date date not null,
  end_date date,
  is_active boolean not null default true,
  notes text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint employee_recurring_deductions_user_id_fkey
    foreign key (user_id) references public.users(id)
);

-- =========================================================
-- 6) PAYROLL
-- =========================================================

create table if not exists public.payroll_records (
  id uuid primary key default gen_random_uuid(),
  payroll_period_id uuid not null,
  user_id uuid not null,
  pay_type text not null
    check (pay_type = any (array[
      'monthly'::text,
      'daily'::text,
      'hourly'::text
    ])),
  basic_rate numeric not null default 0,
  daily_rate numeric not null default 0,
  hourly_rate numeric not null default 0,
  total_work_days numeric not null default 0,
  total_paid_leave_days numeric not null default 0,
  total_unpaid_leave_days numeric not null default 0,
  total_absent_days numeric not null default 0,
  total_late_minutes integer not null default 0,
  total_overtime_minutes integer not null default 0,
  basic_pay numeric not null default 0,
  leave_pay numeric not null default 0,
  overtime_pay numeric not null default 0,
  holiday_pay numeric not null default 0,
  restday_pay numeric not null default 0,
  allowance_pay numeric not null default 0,
  gross_pay numeric not null default 0,
  late_deduction numeric not null default 0,
  undertime_deduction numeric not null default 0,
  absent_deduction numeric not null default 0,
  sss_deduction numeric not null default 0,
  pagibig_deduction numeric not null default 0,
  philhealth_deduction numeric not null default 0,
  tax_deduction numeric not null default 0,
  other_deductions numeric not null default 0,
  total_deductions numeric not null default 0,
  net_pay numeric not null default 0,
  remarks text,
  status text not null default 'draft'::text
    check (status = any (array[
      'draft'::text,
      'computed'::text,
      'reviewed'::text,
      'finalized'::text,
      'released'::text
    ])),
  generated_at timestamp with time zone,
  finalized_at timestamp with time zone,
  released_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint payroll_records_payroll_period_id_fkey
    foreign key (payroll_period_id) references public.payroll_periods(id),
  constraint payroll_records_user_id_fkey
    foreign key (user_id) references public.users(id)
);

create table if not exists public.payroll_record_items (
  id uuid primary key default gen_random_uuid(),
  payroll_record_id uuid not null,
  item_type text not null
    check (item_type = any (array[
      'basic_pay'::text,
      'leave_pay'::text,
      'overtime_pay'::text,
      'holiday_pay'::text,
      'restday_pay'::text,
      'allowance'::text,
      'late_deduction'::text,
      'undertime_deduction'::text,
      'absent_deduction'::text,
      'sss_deduction'::text,
      'pagibig_deduction'::text,
      'philhealth_deduction'::text,
      'tax_deduction'::text,
      'other_deduction'::text,
      'adjustment_add'::text,
      'adjustment_less'::text
    ])),
  description text not null,
  quantity numeric not null default 0,
  rate numeric not null default 0,
  amount numeric not null default 0,
  created_at timestamp with time zone not null default now(),
  constraint payroll_record_items_payroll_record_id_fkey
    foreign key (payroll_record_id) references public.payroll_records(id)
);

create table if not exists public.payroll_adjustments (
  id uuid primary key default gen_random_uuid(),
  payroll_period_id uuid not null,
  user_id uuid not null,
  adjustment_type text not null
    check (adjustment_type = any (array[
      'addition'::text,
      'deduction'::text
    ])),
  name text not null,
  amount numeric not null default 0,
  notes text,
  created_by uuid,
  created_at timestamp with time zone not null default now(),
  constraint payroll_adjustments_payroll_period_id_fkey
    foreign key (payroll_period_id) references public.payroll_periods(id),
  constraint payroll_adjustments_user_id_fkey
    foreign key (user_id) references public.users(id),
  constraint payroll_adjustments_created_by_fkey
    foreign key (created_by) references public.users(id)
);

-- =========================================================
-- 7) INDEXES
-- =========================================================

create index if not exists idx_users_shift_id on public.users(shift_id);
create index if not exists idx_users_department_id on public.users(department_id);

create index if not exists idx_attendance_user_id on public.attendance(user_id);
create index if not exists idx_attendance_date on public.attendance(date);
create index if not exists idx_attendance_location_id on public.attendance(location_id);
create index if not exists idx_attendance_shift_id on public.attendance(shift_id);

create index if not exists idx_holidays_holiday_date on public.holidays(holiday_date);
create index if not exists idx_holidays_location_id on public.holidays(location_id);

create index if not exists idx_user_rest_days_user_id on public.user_rest_days(user_id);

create index if not exists idx_leave_balances_user_id on public.leave_balances(user_id);
create index if not exists idx_leave_balances_leave_type_id on public.leave_balances(leave_type_id);
create index if not exists idx_leave_balances_year on public.leave_balances(year);

create index if not exists idx_leave_requests_user_id on public.leave_requests(user_id);
create index if not exists idx_leave_requests_leave_type_id on public.leave_requests(leave_type_id);
create index if not exists idx_leave_requests_approver_id on public.leave_requests(approver_id);
create index if not exists idx_leave_requests_status on public.leave_requests(status);
create index if not exists idx_leave_requests_date_from on public.leave_requests(date_from);
create index if not exists idx_leave_requests_date_to on public.leave_requests(date_to);

create index if not exists idx_leave_request_dates_leave_request_id on public.leave_request_dates(leave_request_id);
create index if not exists idx_leave_request_dates_leave_date on public.leave_request_dates(leave_date);

create index if not exists idx_employee_compensation_user_id on public.employee_compensation(user_id);
create index if not exists idx_employee_compensation_effective_from on public.employee_compensation(effective_from);
create index if not exists idx_employee_compensation_is_active on public.employee_compensation(is_active);

create index if not exists idx_employee_recurring_deductions_user_id on public.employee_recurring_deductions(user_id);
create index if not exists idx_employee_recurring_deductions_is_active on public.employee_recurring_deductions(is_active);

create index if not exists idx_payroll_records_payroll_period_id on public.payroll_records(payroll_period_id);
create index if not exists idx_payroll_records_user_id on public.payroll_records(user_id);
create index if not exists idx_payroll_records_status on public.payroll_records(status);

create index if not exists idx_payroll_record_items_payroll_record_id on public.payroll_record_items(payroll_record_id);

create index if not exists idx_payroll_adjustments_payroll_period_id on public.payroll_adjustments(payroll_period_id);
create index if not exists idx_payroll_adjustments_user_id on public.payroll_adjustments(user_id);
create index if not exists idx_payroll_adjustments_created_by on public.payroll_adjustments(created_by);

-- =========================================================
-- 8) OPTIONAL UNIQUE RULES
-- =========================================================

create unique index if not exists uq_leave_balances_user_leave_type_year
  on public.leave_balances(user_id, leave_type_id, year);

-- Uncomment if you want one attendance row per user per date:
-- create unique index if not exists uq_attendance_user_date
--   on public.attendance(user_id, date);

-- Uncomment if you want one payroll record per employee per payroll period:
-- create unique index if not exists uq_payroll_records_period_user
--   on public.payroll_records(payroll_period_id, user_id);