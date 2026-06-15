-- RLS policies for one-time payroll adjustments and recurring payroll items.
-- Safe to run once on each Supabase project from the SQL editor.

begin;

-- =========================================================
-- One-time payroll adjustments
-- =========================================================

alter table public.payroll_adjustments enable row level security;

drop policy if exists "Staff can view payroll adjustments" on public.payroll_adjustments;
drop policy if exists "Staff can insert payroll adjustments" on public.payroll_adjustments;
drop policy if exists "Staff can update payroll adjustments" on public.payroll_adjustments;
drop policy if exists "Staff can delete payroll adjustments" on public.payroll_adjustments;
drop policy if exists "Users can view own payroll adjustments" on public.payroll_adjustments;

create policy "Staff can view payroll adjustments"
on public.payroll_adjustments
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

create policy "Staff can insert payroll adjustments"
on public.payroll_adjustments
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

create policy "Staff can update payroll adjustments"
on public.payroll_adjustments
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

create policy "Staff can delete payroll adjustments"
on public.payroll_adjustments
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

create policy "Users can view own payroll adjustments"
on public.payroll_adjustments
for select
to authenticated
using (user_id = auth.uid());

-- =========================================================
-- Recurring payroll additions/deductions
-- =========================================================

alter table public.employee_recurring_deductions enable row level security;

drop policy if exists "Staff can view recurring payroll items" on public.employee_recurring_deductions;
drop policy if exists "Staff can insert recurring payroll items" on public.employee_recurring_deductions;
drop policy if exists "Staff can update recurring payroll items" on public.employee_recurring_deductions;
drop policy if exists "Staff can delete recurring payroll items" on public.employee_recurring_deductions;
drop policy if exists "Users can view own recurring payroll items" on public.employee_recurring_deductions;

create policy "Staff can view recurring payroll items"
on public.employee_recurring_deductions
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

create policy "Staff can insert recurring payroll items"
on public.employee_recurring_deductions
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

create policy "Staff can update recurring payroll items"
on public.employee_recurring_deductions
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

create policy "Staff can delete recurring payroll items"
on public.employee_recurring_deductions
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

create policy "Users can view own recurring payroll items"
on public.employee_recurring_deductions
for select
to authenticated
using (user_id = auth.uid());

commit;
