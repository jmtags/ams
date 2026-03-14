-- SHIFTS
drop policy if exists "admin manage shifts" on public.shifts;
create policy "admin manage shifts"
on public.shifts
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- DEPARTMENTS
drop policy if exists "admin manage departments" on public.departments;
create policy "admin manage departments"
on public.departments
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- LOCATIONS
drop policy if exists "admin manage locations" on public.locations;
create policy "admin manage locations"
on public.locations
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- LEAVE TYPES
alter table public.leave_types enable row level security;
drop policy if exists "admin manage leave types" on public.leave_types;
drop policy if exists "authenticated can view leave types" on public.leave_types;

create policy "admin manage leave types"
on public.leave_types
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "authenticated can view leave types"
on public.leave_types
for select
to authenticated
using (true);

-- HOLIDAYS
alter table public.holidays enable row level security;
drop policy if exists "admin manage holidays" on public.holidays;
drop policy if exists "authenticated can view holidays" on public.holidays;

create policy "admin manage holidays"
on public.holidays
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "authenticated can view holidays"
on public.holidays
for select
to authenticated
using (true);