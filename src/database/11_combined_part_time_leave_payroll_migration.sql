-- Combined migration for part-time payroll, paid leave settings, and compensation access.
-- Safe to run once on each Supabase project from the SQL editor.

begin;

-- =========================================================
-- Leave type payroll flags
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

-- =========================================================
-- Recurring payroll additions/deductions
-- =========================================================

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

-- =========================================================
-- Employee compensation fields for part-time mode
-- =========================================================

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

-- =========================================================
-- Payroll record fields for generated part-time summaries
-- =========================================================

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
-- Employee compensation RLS
-- =========================================================

alter table public.employee_compensation enable row level security;

drop policy if exists "Staff can view employee compensation" on public.employee_compensation;
drop policy if exists "Staff can insert employee compensation" on public.employee_compensation;
drop policy if exists "Staff can update employee compensation" on public.employee_compensation;
drop policy if exists "Staff can delete employee compensation" on public.employee_compensation;
drop policy if exists "Users can view own employee compensation" on public.employee_compensation;

create policy "Staff can view employee compensation"
on public.employee_compensation
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

create policy "Staff can insert employee compensation"
on public.employee_compensation
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

create policy "Staff can update employee compensation"
on public.employee_compensation
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

create policy "Staff can delete employee compensation"
on public.employee_compensation
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

create policy "Users can view own employee compensation"
on public.employee_compensation
for select
to authenticated
using (user_id = auth.uid());

commit;
