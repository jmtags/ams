-- Adds editable government contribution tables and withholding tax support.

begin;

alter table public.employee_compensation
  add column if not exists deduct_withholding_tax boolean not null default false;

create table if not exists public.government_contribution_settings (
  id uuid primary key default gen_random_uuid(),
  setting_type text not null
    check (setting_type = any (array[
      'sss'::text,
      'philhealth'::text,
      'pagibig'::text,
      'withholding_tax'::text
    ])),
  name text not null,
  effective_from date not null default current_date,
  is_active boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists idx_government_contribution_settings_type
  on public.government_contribution_settings(setting_type);

create index if not exists idx_government_contribution_settings_active
  on public.government_contribution_settings(is_active);

alter table public.government_contribution_settings enable row level security;

drop policy if exists "Staff can view government contribution settings"
  on public.government_contribution_settings;
drop policy if exists "Staff can insert government contribution settings"
  on public.government_contribution_settings;
drop policy if exists "Staff can update government contribution settings"
  on public.government_contribution_settings;
drop policy if exists "Staff can delete government contribution settings"
  on public.government_contribution_settings;

create policy "Staff can view government contribution settings"
on public.government_contribution_settings for select to authenticated
using (
  exists (
    select 1 from public.users u
    where u.id = auth.uid()
      and u.role in ('admin', 'hr', 'payroll')
  )
);

create policy "Staff can insert government contribution settings"
on public.government_contribution_settings for insert to authenticated
with check (
  exists (
    select 1 from public.users u
    where u.id = auth.uid()
      and u.role in ('admin', 'hr', 'payroll')
  )
);

create policy "Staff can update government contribution settings"
on public.government_contribution_settings for update to authenticated
using (
  exists (
    select 1 from public.users u
    where u.id = auth.uid()
      and u.role in ('admin', 'hr', 'payroll')
  )
)
with check (
  exists (
    select 1 from public.users u
    where u.id = auth.uid()
      and u.role in ('admin', 'hr', 'payroll')
  )
);

create policy "Staff can delete government contribution settings"
on public.government_contribution_settings for delete to authenticated
using (
  exists (
    select 1 from public.users u
    where u.id = auth.uid()
      and u.role in ('admin', 'hr', 'payroll')
  )
);

commit;
