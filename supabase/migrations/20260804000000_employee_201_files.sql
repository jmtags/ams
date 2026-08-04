begin;

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
    check (employment_type = any (array[
      'all'::text,
      'regular'::text,
      'part_time'::text
    ])),
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
    check (status = any (array[
      'submitted'::text,
      'verified'::text,
      'rejected'::text,
      'expired'::text
    ])),
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

create index if not exists idx_document_categories_active
  on public.document_categories(is_active);
create index if not exists idx_document_requirements_active
  on public.document_requirements(is_active);
create index if not exists idx_employee_documents_user_id
  on public.employee_documents(user_id);
create index if not exists idx_employee_documents_requirement_id
  on public.employee_documents(requirement_id);
create index if not exists idx_employee_documents_status
  on public.employee_documents(status);
create index if not exists idx_employee_documents_expiry_date
  on public.employee_documents(expiry_date);
create index if not exists idx_employee_document_activity_document_id
  on public.employee_document_activity_logs(document_id);

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

insert into public.document_categories (name, description, sort_order)
select *
from (values
  ('Personal Documents', 'Identity and personal records', 10),
  ('Employment Documents', 'Contracts and employment records', 20),
  ('Government Records', 'SSS, PhilHealth, Pag-IBIG, and TIN documents', 30),
  ('Payroll Documents', 'Bank and compensation documents', 40),
  ('Performance', 'Performance evaluations and commendations', 50),
  ('Disciplinary', 'Incident reports and notices', 60),
  ('Training', 'Certificates and training records', 70),
  ('Exit Documents', 'Resignation, clearance, and final documents', 80)
) as defaults(name, description, sort_order)
where not exists (
  select 1 from public.document_categories c where c.name = defaults.name
);

insert into public.document_requirements
  (category_id, name, description, is_required, requires_expiry, employee_upload_allowed, sort_order)
select
  c.id,
  r.name,
  r.description,
  r.is_required,
  r.requires_expiry,
  r.employee_upload_allowed,
  r.sort_order
from (values
  ('Personal Documents', 'Resume / CV', 'Employee resume or curriculum vitae', true, false, true, 10),
  ('Personal Documents', 'Valid Government ID', 'Primary valid identification document', true, true, true, 20),
  ('Employment Documents', 'Employment Contract', 'Signed employment contract or appointment document', true, false, false, 30),
  ('Government Records', 'SSS Record', 'SSS number or supporting document', true, false, true, 40),
  ('Government Records', 'PhilHealth Record', 'PhilHealth number or supporting document', true, false, true, 50),
  ('Government Records', 'Pag-IBIG Record', 'Pag-IBIG number or supporting document', true, false, true, 60),
  ('Government Records', 'TIN Record', 'Tax identification number or BIR document', true, false, true, 70),
  ('Payroll Documents', 'Bank Account Form', 'Payroll bank account or ATM document', true, false, true, 80),
  ('Personal Documents', 'Medical Certificate', 'Pre-employment or fit-to-work medical document', false, true, true, 90),
  ('Training', 'Training Certificate', 'Training or certification document', false, true, true, 100)
) as r(category_name, name, description, is_required, requires_expiry, employee_upload_allowed, sort_order)
join public.document_categories c on c.name = r.category_name
where not exists (
  select 1 from public.document_requirements existing where existing.name = r.name
);

commit;
