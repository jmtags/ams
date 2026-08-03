begin;

alter table public.employee_compensation
  add column if not exists deduct_sss boolean not null default true,
  add column if not exists deduct_philhealth boolean not null default true,
  add column if not exists deduct_pagibig boolean not null default true,
  add column if not exists government_contribution_frequency text not null default 'monthly_second_half';

alter table public.employee_compensation
  drop constraint if exists employee_compensation_government_contribution_frequency_check;

alter table public.employee_compensation
  add constraint employee_compensation_government_contribution_frequency_check
  check (government_contribution_frequency = any (array[
    'every_payroll'::text,
    'monthly_first_half'::text,
    'monthly_second_half'::text
  ]));

alter table public.payroll_records
  add column if not exists sss_employer_contribution numeric not null default 0,
  add column if not exists pagibig_employer_contribution numeric not null default 0,
  add column if not exists philhealth_employer_contribution numeric not null default 0,
  add column if not exists sss_monthly_salary_credit numeric not null default 0,
  add column if not exists pagibig_monthly_salary_base numeric not null default 0,
  add column if not exists philhealth_monthly_salary_base numeric not null default 0;

commit;
