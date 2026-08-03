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

insert into public.government_contribution_settings
  (setting_type, name, effective_from, is_active, config)
select
  'sss',
  'SSS 2025 Default',
  '2025-01-01',
  true,
  '{
    "salary_ranges": [
      { "min": 0, "max": 4999.99, "monthly_salary_credit": 5000, "employee_rate": 0.05, "employer_rate": 0.10 },
      { "min": 5000, "max": 34999.99, "monthly_salary_credit": null, "employee_rate": 0.05, "employer_rate": 0.10 },
      { "min": 35000, "max": null, "monthly_salary_credit": 35000, "employee_rate": 0.05, "employer_rate": 0.10 }
    ]
  }'::jsonb
where not exists (
  select 1 from public.government_contribution_settings
  where setting_type = 'sss'
);

insert into public.government_contribution_settings
  (setting_type, name, effective_from, is_active, config)
select
  'philhealth',
  'PhilHealth 2025 Default',
  '2025-01-01',
  true,
  '{ "salary_floor": 10000, "salary_ceiling": 100000, "total_rate": 0.05, "employee_share": 0.5, "employer_share": 0.5 }'::jsonb
where not exists (
  select 1 from public.government_contribution_settings
  where setting_type = 'philhealth'
);

insert into public.government_contribution_settings
  (setting_type, name, effective_from, is_active, config)
select
  'pagibig',
  'Pag-IBIG 2024 Default',
  '2024-02-01',
  true,
  '{ "salary_cap": 10000, "employee_rate": 0.02, "employer_rate": 0.02 }'::jsonb
where not exists (
  select 1 from public.government_contribution_settings
  where setting_type = 'pagibig'
);

insert into public.government_contribution_settings
  (setting_type, name, effective_from, is_active, config)
select
  'withholding_tax',
  'BIR Withholding Tax Table 2023 Onwards',
  '2023-01-01',
  true,
  '{
    "tables": {
      "semi_monthly": [
        { "min": 0, "max": 10417, "base_tax": 0, "excess_over": 0, "rate": 0 },
        { "min": 10417, "max": 16666, "base_tax": 0, "excess_over": 10417, "rate": 0.15 },
        { "min": 16667, "max": 33332, "base_tax": 937.5, "excess_over": 16667, "rate": 0.20 },
        { "min": 33333, "max": 83332, "base_tax": 4270.7, "excess_over": 33333, "rate": 0.25 },
        { "min": 83333, "max": 333332, "base_tax": 16770.7, "excess_over": 83333, "rate": 0.30 },
        { "min": 333333, "max": null, "base_tax": 91770.7, "excess_over": 333333, "rate": 0.35 }
      ],
      "monthly": [
        { "min": 0, "max": 20833, "base_tax": 0, "excess_over": 0, "rate": 0 },
        { "min": 20833, "max": 33332, "base_tax": 0, "excess_over": 20833, "rate": 0.15 },
        { "min": 33333, "max": 66666, "base_tax": 1875, "excess_over": 33333, "rate": 0.20 },
        { "min": 66667, "max": 166666, "base_tax": 8541.8, "excess_over": 66667, "rate": 0.25 },
        { "min": 166667, "max": 666666, "base_tax": 33541.8, "excess_over": 166667, "rate": 0.30 },
        { "min": 666667, "max": null, "base_tax": 183541.8, "excess_over": 666667, "rate": 0.35 }
      ]
    }
  }'::jsonb
where not exists (
  select 1 from public.government_contribution_settings
  where setting_type = 'withholding_tax'
);

commit;
