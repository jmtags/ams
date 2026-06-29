-- Corporate HR policy documents shared with employees across instances.

create table if not exists public.policy_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category text,
  file_url text not null,
  file_name text not null,
  file_size bigint,
  storage_path text,
  is_active boolean not null default true,
  created_by uuid references public.users(id),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists idx_policy_documents_active_updated
on public.policy_documents(is_active, updated_at desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'policy-documents',
  'policy-documents',
  true,
  20971520,
  array['application/pdf']::text[]
)
on conflict (id) do update
set
  public = true,
  file_size_limit = 20971520,
  allowed_mime_types = array['application/pdf']::text[];

alter table public.policy_documents enable row level security;

drop policy if exists "Authenticated users can view active policy documents" on public.policy_documents;
drop policy if exists "Staff can manage policy documents" on public.policy_documents;
drop policy if exists "Public can view policy PDFs" on storage.objects;
drop policy if exists "Staff can upload policy PDFs" on storage.objects;
drop policy if exists "Staff can update policy PDFs" on storage.objects;
drop policy if exists "Staff can delete policy PDFs" on storage.objects;

create policy "Authenticated users can view active policy documents"
on public.policy_documents for select to authenticated
using (is_active = true);

create policy "Staff can manage policy documents"
on public.policy_documents for all to authenticated
using (
  exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role in ('admin', 'hr', 'payroll')
  )
)
with check (
  exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role in ('admin', 'hr', 'payroll')
  )
);

create policy "Public can view policy PDFs"
on storage.objects for select to public
using (bucket_id = 'policy-documents');

create policy "Staff can upload policy PDFs"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'policy-documents'
  and exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role in ('admin', 'hr', 'payroll')
  )
);

create policy "Staff can update policy PDFs"
on storage.objects for update to authenticated
using (
  bucket_id = 'policy-documents'
  and exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role in ('admin', 'hr', 'payroll')
  )
)
with check (
  bucket_id = 'policy-documents'
  and exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role in ('admin', 'hr', 'payroll')
  )
);

create policy "Staff can delete policy PDFs"
on storage.objects for delete to authenticated
using (
  bucket_id = 'policy-documents'
  and exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role in ('admin', 'hr', 'payroll')
  )
);
