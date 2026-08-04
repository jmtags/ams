-- Digital 201 File Management for employee HR documents.
-- Run on each instance where HR will manage employee files.

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

commit;
