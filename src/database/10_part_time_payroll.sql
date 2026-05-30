alter table public.employee_compensation
  add column if not exists employment_type text not null default 'regular',
  add column if not exists unpaid_break_minutes integer not null default 60;

alter table public.employee_compensation
  drop constraint if exists employee_compensation_employment_type_check;

alter table public.employee_compensation
  add constraint employee_compensation_employment_type_check
  check (employment_type = any (array['regular'::text, 'part_time'::text]));

alter table public.payroll_records
  add column if not exists employment_type text not null default 'regular',
  add column if not exists unpaid_break_minutes integer not null default 60,
  add column if not exists total_work_minutes integer not null default 0;

alter table public.payroll_records
  drop constraint if exists payroll_records_employment_type_check;

alter table public.payroll_records
  add constraint payroll_records_employment_type_check
  check (employment_type = any (array['regular'::text, 'part_time'::text]));

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
