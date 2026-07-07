-- Documents attached to recurring payroll item cases.

create table if not exists public.employee_recurring_deduction_attachments (
  id uuid primary key default gen_random_uuid(),
  recurring_deduction_id uuid not null
    references public.employee_recurring_deductions(id) on delete cascade,
  file_url text not null,
  file_name text not null,
  file_size bigint,
  file_type text,
  storage_path text not null,
  uploaded_by uuid references public.users(id),
  created_at timestamp with time zone not null default now()
);

create index if not exists idx_recurring_deduction_attachments_case
on public.employee_recurring_deduction_attachments(recurring_deduction_id, created_at desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'recurring-deduction-attachments',
  'recurring-deduction-attachments',
  true,
  20971520,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/plain'
  ]::text[]
)
on conflict (id) do update
set
  public = true,
  file_size_limit = 20971520,
  allowed_mime_types = array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/plain'
  ]::text[];

alter table public.employee_recurring_deduction_attachments enable row level security;

drop policy if exists "Staff can view recurring deduction attachments" on public.employee_recurring_deduction_attachments;
drop policy if exists "Employees can view own recurring deduction attachments" on public.employee_recurring_deduction_attachments;
drop policy if exists "Staff can insert recurring deduction attachments" on public.employee_recurring_deduction_attachments;
drop policy if exists "Staff can delete recurring deduction attachments" on public.employee_recurring_deduction_attachments;
drop policy if exists "Public can view recurring deduction files" on storage.objects;
drop policy if exists "Staff can upload recurring deduction files" on storage.objects;
drop policy if exists "Staff can update recurring deduction files" on storage.objects;
drop policy if exists "Staff can delete recurring deduction files" on storage.objects;

create policy "Staff can view recurring deduction attachments"
on public.employee_recurring_deduction_attachments for select to authenticated
using (
  exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role in ('admin', 'hr', 'payroll')
  )
);

create policy "Employees can view own recurring deduction attachments"
on public.employee_recurring_deduction_attachments for select to authenticated
using (
  exists (
    select 1
    from public.employee_recurring_deductions d
    where d.id = recurring_deduction_id
      and d.user_id = auth.uid()
  )
);

create policy "Staff can insert recurring deduction attachments"
on public.employee_recurring_deduction_attachments for insert to authenticated
with check (
  exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role in ('admin', 'hr', 'payroll')
  )
);

create policy "Staff can delete recurring deduction attachments"
on public.employee_recurring_deduction_attachments for delete to authenticated
using (
  exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role in ('admin', 'hr', 'payroll')
  )
);

create policy "Public can view recurring deduction files"
on storage.objects for select to public
using (bucket_id = 'recurring-deduction-attachments');

create policy "Staff can upload recurring deduction files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'recurring-deduction-attachments'
  and exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role in ('admin', 'hr', 'payroll')
  )
);

create policy "Staff can update recurring deduction files"
on storage.objects for update to authenticated
using (
  bucket_id = 'recurring-deduction-attachments'
  and exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role in ('admin', 'hr', 'payroll')
  )
)
with check (
  bucket_id = 'recurring-deduction-attachments'
  and exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role in ('admin', 'hr', 'payroll')
  )
);

create policy "Staff can delete recurring deduction files"
on storage.objects for delete to authenticated
using (
  bucket_id = 'recurring-deduction-attachments'
  and exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role in ('admin', 'hr', 'payroll')
  )
);
