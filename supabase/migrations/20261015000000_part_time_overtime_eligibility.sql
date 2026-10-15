-- Part-time employees are paid for actual hours, with no separate overtime.
-- Existing approvals are retained for explicit review/rejection by staff.
begin;

alter table public.attendance
  add column if not exists approved_overtime_minutes integer not null default 0,
  add column if not exists overtime_status text not null default 'pending';

create or replace function public.enforce_part_time_overtime_eligibility()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  employee_type text;
  normalize_overtime boolean;
begin
  select c.employment_type into employee_type
  from public.employee_compensation c
  where c.user_id = new.user_id
    and c.is_active = true
    and c.effective_from <= new.date
    and (c.effective_to is null or c.effective_to >= new.date)
  order by c.effective_from desc
  limit 1;

  if employee_type is distinct from 'part_time' then
    return new;
  end if;

  if new.overtime_status = 'approved' or coalesce(new.approved_overtime_minutes, 0) > 0 then
    raise exception 'Part-time employees are paid for actual hours and are not eligible for overtime.';
  end if;

  if tg_op = 'INSERT' then
    normalize_overtime := true;
  else
    -- A staff rejection preserves the rendered minutes as review evidence.
    -- New clock punches, manual edits and new pending claims cannot create OT.
    normalize_overtime := new.overtime_status is distinct from 'rejected'
      or new.user_id is distinct from old.user_id
      or new.date is distinct from old.date
      or new.clock_in is distinct from old.clock_in
      or new.clock_out is distinct from old.clock_out
      or new.status is distinct from old.status
      or new.is_overtime is distinct from old.is_overtime
      or new.minutes_overtime is distinct from old.minutes_overtime;
  end if;

  if normalize_overtime then
    new.is_overtime := false;
    new.minutes_overtime := 0;
    new.approved_overtime_minutes := 0;
    new.overtime_status := 'rejected';
    if new.status = 'late_overtime' then
      new.status := 'late';
    elsif new.status = 'overtime' then
      new.status := 'present';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_part_time_overtime_eligibility() from public;

drop trigger if exists enforce_part_time_overtime_eligibility on public.attendance;
create trigger enforce_part_time_overtime_eligibility
before insert or update of user_id, date, clock_in, clock_out, status,
  is_overtime, minutes_overtime, approved_overtime_minutes, overtime_status
on public.attendance
for each row execute function public.enforce_part_time_overtime_eligibility();

commit;
