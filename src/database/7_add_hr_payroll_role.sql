alter table public.users
drop constraint if exists users_role_check;

alter table public.users
add constraint users_role_check
check (role in ('user', 'admin', 'hr', 'payroll'));



alter table public.attendance enable row level security;

drop policy if exists "Staff can view attendance" on public.attendance;
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

drop policy if exists "Staff can insert attendance" on public.attendance;
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

drop policy if exists "Staff can update attendance" on public.attendance;
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

drop policy if exists "Staff can delete attendance" on public.attendance;
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

alter table public.leave_requests enable row level security;

drop policy if exists "Staff can view leave requests" on public.leave_requests;
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

drop policy if exists "Staff can insert leave requests" on public.leave_requests;
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

drop policy if exists "Staff can update leave requests" on public.leave_requests;
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

drop policy if exists "Staff can delete leave requests" on public.leave_requests;
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

alter table public.attendance_adjustments enable row level security;

drop policy if exists "Staff can view attendance adjustments" on public.attendance_adjustments;
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

drop policy if exists "Staff can insert attendance adjustments" on public.attendance_adjustments;
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

drop policy if exists "Staff can update attendance adjustments" on public.attendance_adjustments;
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

drop policy if exists "Staff can delete attendance adjustments" on public.attendance_adjustments;
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

alter table public.users enable row level security;

drop policy if exists "Staff can view users" on public.users;
drop policy if exists "Staff can insert users" on public.users;
drop policy if exists "Staff can update users" on public.users;
drop policy if exists "Staff can delete users" on public.users;
drop policy if exists "Admins and HR can view users" on public.users;
drop policy if exists "Admins and HR can update users" on public.users;
drop policy if exists "Users can view own profile" on public.users;
drop policy if exists "Users can update own profile" on public.users;