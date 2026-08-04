-- Fixes Digital 201 File RLS role checks by using a security-definer helper.

begin;

create or replace function public.is_201_file_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role in ('admin', 'hr')
  );
$$;

grant execute on function public.is_201_file_staff() to authenticated, anon, public;

drop policy if exists "Staff can manage document categories" on public.document_categories;
drop policy if exists "Staff can manage document requirements" on public.document_requirements;
drop policy if exists "Staff can manage employee documents" on public.employee_documents;
drop policy if exists "Users can view own employee documents" on public.employee_documents;
drop policy if exists "Staff can view document activity logs" on public.employee_document_activity_logs;
drop policy if exists "Staff can insert document activity logs" on public.employee_document_activity_logs;

create policy "Staff can manage document categories"
on public.document_categories for all to authenticated
using (public.is_201_file_staff())
with check (public.is_201_file_staff());

create policy "Staff can manage document requirements"
on public.document_requirements for all to authenticated
using (public.is_201_file_staff())
with check (public.is_201_file_staff());

create policy "Staff can manage employee documents"
on public.employee_documents for all to authenticated
using (public.is_201_file_staff())
with check (public.is_201_file_staff());

create policy "Users can view own employee documents"
on public.employee_documents for select to authenticated
using (user_id = auth.uid());

create policy "Staff can view document activity logs"
on public.employee_document_activity_logs for select to authenticated
using (public.is_201_file_staff());

create policy "Staff can insert document activity logs"
on public.employee_document_activity_logs for insert to authenticated
with check (public.is_201_file_staff());

commit;
