import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import { transformSync } from 'esbuild';

const source = transformSync(
  readFileSync(new URL('../src/app/services/payroll.service.ts', import.meta.url), 'utf8'),
  { loader: 'ts', format: 'cjs' },
).code;

async function generate({ payType = 'daily', employmentType = 'regular', attendance = {}, extraAttendance = [], leaves = [], compensation = {} } = {}) {
  const row = {
    user_id: 'employee', date: '2026-10-01', status: 'late',
    scheduled_start: '2026-10-01T00:00:00Z', scheduled_end: '2026-10-01T09:00:00Z',
    clock_in: '2026-10-01T00:30:00Z', clock_out: '2026-10-01T09:00:00Z',
    shifts: { grace_minutes: 10 }, ...attendance,
  };
  const tables = {
    payroll_periods: { date_from: '2026-10-01', date_to: '2026-10-15' },
    users: [{ id: 'employee' }],
    employee_compensation: [{ user_id: 'employee', pay_type: payType, employment_type: employmentType,
      basic_monthly_rate: 17600, daily_rate: 800, hourly_rate: 100, unpaid_break_minutes: 60,
      deduct_sss: false, deduct_pagibig: false, deduct_philhealth: false, deduct_tax: false, ...compensation }],
    attendance: [row, ...extraAttendance.map(item => ({ ...row, ...item }))],
    leave_request_dates: leaves, holidays: [], payroll_settings: {},
    payroll_adjustments: [], employee_recurring_deductions: [], payroll_records: [],
  };
  const inserted = {};
  const supabase = { from(table) {
    let operation = 'select';
    let payload;
    const query = new Proxy({}, { get(_, method) {
      if (method === 'then') return resolve => {
        if (operation === 'insert') inserted[table] = payload;
        resolve({ data: operation === 'insert' ? payload.map((record, i) => ({ ...record, id: String(i) })) : tables[table], error: null });
      };
      return (...args) => {
        if (['insert', 'update', 'delete'].includes(method)) { operation = method; payload = args[0]; }
        return query;
      };
    } });
    return query;
  } };
  const module = { exports: {} };
  vm.runInNewContext(source, { module, exports: module.exports, require(name) {
    if (name === '../lib/supabase') return { supabase };
    if (name === './government-contribution-settings.service') return {
      governmentContributionSettingsService: { getActiveByType: async () => ({}) },
    };
    throw new Error(`Unexpected import: ${name}`);
  } });
  await module.exports.payrollService.generatePayroll('period');
  return { record: inserted.payroll_records[0], items: inserted.payroll_record_items };
}

for (const payType of ['daily', 'hourly', 'monthly']) {
  test(`${payType}: full-time base pay credits the shift and deducts lateness once`, async () => {
    const { record, items } = await generate({ payType });
    assert.equal(record.total_work_minutes, 480);
    assert.equal(record.basic_pay, payType === 'monthly' ? 8800 : 800);
    assert.equal(record.late_deduction, 50);
    assert.equal(record.net_pay, record.basic_pay - 50);
    assert.equal(items.filter(item => item.item_type === 'late_deduction').length, 1);
  });
}

for (const [minutes, deduction] of [[9, 0], [10, 100 / 6], [30, 50]]) {
  test(`existing grace rule: ${minutes} minutes late`, async () => {
    const { record } = await generate({ attendance: { clock_in: `2026-10-01T00:${String(minutes).padStart(2, '0')}:00Z` } });
    assert.equal(record.basic_pay, 800);
    assert.equal(record.late_deduction, Math.round(deduction * 100) / 100);
  });
}

test('early departure and missing punches do not reduce full-time shift credit', async () => {
  for (const clock_out of ['2026-10-01T03:00:00Z', null]) {
    const { record } = await generate({ attendance: { clock_out } });
    assert.equal(record.basic_pay, 800);
    assert.equal(record.total_work_minutes, 480);
    assert.equal(record.undertime_deduction, clock_out ? 600 : 0);
    assert.equal(record.net_pay, clock_out ? 150 : 750);
  }
});

test('approved overtime is paid separately without reducing shift credit', async () => {
  const { record } = await generate({ attendance: {
    status: 'late_overtime', clock_out: '2026-10-01T10:00:00Z',
    overtime_status: 'approved', approved_overtime_minutes: 60,
  } });
  assert.equal(record.basic_pay, 800);
  assert.equal(record.overtime_pay, 125);
  assert.equal(record.net_pay, 875);
});

test('scheduled hours support shorter and overnight shifts, with default hours when missing', async () => {
  for (const [attendance, expected] of [
    [{ scheduled_end: '2026-10-01T05:00:00Z' }, 240],
    [{ scheduled_start: '2026-09-30T20:00:00Z', scheduled_end: '2026-10-01T05:00:00Z' }, 480],
    [{ scheduled_start: null, scheduled_end: null }, 480],
  ]) {
    const { record } = await generate({ payType: 'hourly', attendance });
    assert.equal(record.total_work_minutes, expected);
    assert.equal(record.basic_pay, expected / 60 * 100);
  }
});

test('part-time pay still uses actual hours without a separate late deduction', async () => {
  const { record } = await generate({ employmentType: 'part_time' });
  assert.equal(record.total_work_minutes, 450);
  assert.equal(record.basic_pay, 750);
  assert.equal(record.late_deduction, 0);
  assert.equal(record.net_pay, 750);
});

test('absences and unpaid leave retain the existing monthly deduction', async () => {
  const { record } = await generate({ payType: 'monthly',
    extraAttendance: [{ date: '2026-10-02', status: 'absent', clock_in: null, clock_out: null }],
    leaves: [{ leave_date: '2026-10-03', day_value: 1, leave_requests: { user_id: 'employee', leave_types: { counts_for_payroll: true, is_paid: false } } }],
  });
  assert.equal(record.total_work_minutes, 480);
  assert.equal(record.absent_deduction, 1600);
  assert.equal(record.net_pay, 7150);
});

for (const payType of ['daily', 'hourly', 'monthly']) {
  test(`${payType}: lateness and undertime each deducted once from expected pay`, async () => {
    const { record, items } = await generate({ payType, attendance: { clock_out: '2026-10-01T08:30:00Z' } });
    assert.equal(record.total_work_minutes, 480);
    assert.equal(record.basic_pay, payType === 'monthly' ? 8800 : 800);
    assert.equal(record.late_deduction, 50);
    assert.equal(record.undertime_deduction, 50);
    assert.equal(record.total_deductions, 100);
    assert.equal(record.net_pay, record.basic_pay - 100);
    const undertimeItems = items.filter(item => item.item_type === 'undertime_deduction');
    assert.equal(undertimeItems.length, 1);
    assert.equal(undertimeItems[0].quantity, 30);
    assert.equal(undertimeItems[0].rate, 100 / 60);
    assert.equal(undertimeItems[0].amount, 50);
    assert.equal(items.filter(item => item.item_type.endsWith('_deduction')).reduce((sum, item) => sum + item.amount, 0), record.total_deductions);
  });
}

test('configured hourly undertime rate overrides the normal hourly rate', async () => {
  const { record } = await generate({ compensation: { undertime_deduction_rate: 200 }, attendance: { clock_out: '2026-10-01T08:30:00Z' } });
  assert.equal(record.undertime_deduction, 100);
  assert.equal(record.net_pay, 650);
});

test('undertime uses completed early-departure minutes even within the late grace period', async () => {
  const { record } = await generate({ attendance: { clock_in: '2026-10-01T00:09:00Z', clock_out: '2026-10-01T08:58:30Z' } });
  assert.equal(record.late_deduction, 0);
  assert.equal(record.undertime_deduction, 1.67);
  assert.equal(record.net_pay, 798.33);
});

test('part-time early departure reduces actual hours without separate undertime deduction', async () => {
  const { record, items } = await generate({ employmentType: 'part_time', attendance: { clock_out: '2026-10-01T08:00:00Z' } });
  assert.equal(record.basic_pay, 700);
  assert.equal(record.undertime_deduction, 0);
  assert.equal(record.net_pay, 700);
  assert.equal(items.some(item => item.item_type === 'undertime_deduction'), false);
});

test('missing, invalid, on-time, and later clock-outs do not produce undertime', async () => {
  for (const attendance of [
    { clock_out: null },
    { clock_in: null, clock_out: '2026-10-01T08:00:00Z' },
    { clock_out: 'invalid' },
    { scheduled_end: null, clock_out: '2026-10-01T08:00:00Z' },
    { clock_out: '2026-10-01T09:00:00Z' },
    { clock_out: '2026-10-01T10:00:00Z' },
    { clock_out: '2026-09-30T23:00:00Z' },
  ]) {
    const { record, items } = await generate({ attendance });
    assert.equal(record.undertime_deduction, 0);
    assert.equal(items.some(item => item.item_type === 'undertime_deduction'), false);
  }
});

test('overnight early departure is deducted from the scheduled end date', async () => {
  const { record } = await generate({ attendance: {
    scheduled_start: '2026-10-01T20:00:00Z', scheduled_end: '2026-10-02T05:00:00Z',
    clock_in: '2026-10-01T20:00:00Z', clock_out: '2026-10-02T04:00:00Z',
  } });
  assert.equal(record.basic_pay, 800);
  assert.equal(record.late_deduction, 0);
  assert.equal(record.undertime_deduction, 100);
  assert.equal(record.net_pay, 700);
});

for (const overtimeStatus of ['approved', 'pending', 'rejected']) {
  test(`part-time ${overtimeStatus} OT is paid entirely as ordinary worked hours`, async () => {
    const { record, items } = await generate({ employmentType: 'part_time', attendance: {
      status: 'late_overtime', clock_out: '2026-10-01T10:00:00Z',
      overtime_status: overtimeStatus, approved_overtime_minutes: 60, minutes_overtime: 60,
    } });
    assert.equal(record.total_work_minutes, 510);
    assert.equal(record.basic_pay, 850);
    assert.equal(record.total_overtime_minutes, 0);
    assert.equal(record.overtime_pay, 0);
    assert.equal(record.net_pay, 850);
    assert.equal(items.some(item => item.item_type === 'overtime_pay'), false);
  });
}

test('part-time hours use actual clock-in even inside the full-time grace period', async () => {
  const { record } = await generate({ employmentType: 'part_time', attendance: {
    clock_in: '2026-10-01T00:09:00Z',
  } });
  assert.equal(record.total_work_minutes, 471);
  assert.equal(record.basic_pay, 785);
});

test('rejecting full-time approved OT removes its premium on regeneration', async () => {
  const { record, items } = await generate({ attendance: {
    status: 'late_overtime', clock_out: '2026-10-01T10:00:00Z',
    overtime_status: 'rejected', approved_overtime_minutes: 0, minutes_overtime: 60,
  } });
  assert.equal(record.basic_pay, 800);
  assert.equal(record.overtime_pay, 0);
  assert.equal(record.net_pay, 750);
  assert.equal(items.some(item => item.item_type === 'overtime_pay'), false);
});
