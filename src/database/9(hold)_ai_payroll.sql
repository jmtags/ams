create table if not exists ai_review_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  review_type text not null, -- attendance, payroll_precheck, employee_audit
  date_from date not null,
  date_to date not null,
  employee_id uuid null references users(id),
  department_id uuid null references departments(id),
  location_id uuid null references locations(id),
  status text not null default 'completed', -- queued, completed, failed
  summary text,
  model_name text,
  raw_result jsonb,
  total_findings int not null default 0,
  high_count int not null default 0,
  medium_count int not null default 0,
  low_count int not null default 0
);

create table if not exists ai_review_findings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  run_id uuid not null references ai_review_runs(id) on delete cascade,
  employee_id uuid null references users(id),
  attendance_id uuid null references attendance(id),
  leave_request_id uuid null references leave_requests(id),
  activity_log_id uuid null,
  category text not null, -- missing_clockout, leave_conflict, ot_mismatch, suspicious_pattern
  severity text not null, -- high, medium, low
  title text not null,
  explanation text not null,
  recommended_action text,
  confidence numeric(5,2),
  source_data jsonb,
  status text not null default 'open', -- open, acknowledged, resolved, false_positive
  reviewed_by uuid null references auth.users(id),
  reviewed_at timestamptz null
);

create index if not exists idx_ai_review_runs_created_at on ai_review_runs(created_at desc);
create index if not exists idx_ai_review_findings_run_id on ai_review_findings(run_id);
create index if not exists idx_ai_review_findings_employee_id on ai_review_findings(employee_id);
create index if not exists idx_ai_review_findings_status on ai_review_findings(status);