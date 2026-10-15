import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import { transformSync } from 'esbuild';

function setup(type = 'part_time', options = {}) {
  const updates = [];
  const compensation = { employment_type: type, effective_from: '2026-01-01', effective_to: null, is_active: true };
  const db = { from(table) {
    let payload;
    let single = false;
    const query = new Proxy({}, { get(_, method) {
      if (method === 'then') return resolve => {
        if (payload) updates.push({ table, payload });
        const data = options.data?.[table] ?? (table === 'employee_compensation' ? [compensation]
          : single ? { id: 'attendance', user_id: 'employee', date: '2026-10-01', overtime_status: 'approved', approved_overtime_minutes: 60 }
          : [{ id: 'attendance', date: '2026-10-01', users: { employee_compensation: [compensation] } }]);
        resolve({ data, error: options.errorTable === table ? new Error('Access denied') : null });
      };
      return (...args) => {
        if (method === 'update' || method === 'insert') payload = args[0];
        if (method === 'single') single = true;
        return query;
      };
    } });
    return query;
  } };
  const cache = {};
  function load(name) {
    if (cache[name]) return cache[name];
    const source = fs.readFileSync(new URL(`../src/app/services/${name}.ts`, import.meta.url), 'utf8');
    const module = { exports: {} };
    vm.runInNewContext(transformSync(source, { loader: 'ts', format: 'cjs' }).code, {
      module, exports: module.exports, require(specifier) {
        if (specifier === '../lib/supabase') return { supabase: db };
        if (specifier.startsWith('./')) return load(specifier.slice(2));
        throw new Error(`Unexpected dependency ${specifier}`);
      },
    });
    return cache[name] = module.exports;
  }
  return { load, updates };
}

test('employment type uses active compensation applicable to attendance date', () => {
  const { load } = setup();
  const { employmentTypeOnDate } = load('overtime-eligibility.service');
  const rows = [
    { employment_type: 'part_time', effective_from: '2026-01-01', effective_to: null, is_active: true },
    { employment_type: 'regular', effective_from: '2026-11-01', effective_to: null, is_active: true },
    { employment_type: 'regular', effective_from: '2026-09-01', effective_to: null, is_active: false },
    { employment_type: 'regular', effective_from: '2026-09-15', effective_to: '2026-09-30', is_active: true },
  ];
  assert.equal(employmentTypeOnDate(rows, '2026-10-01'), 'part_time');
  assert.equal(employmentTypeOnDate(rows, '2026-11-01'), 'regular');
});

test('part-time OT approval fails before any attendance write', async () => {
  const { load, updates } = setup();
  await assert.rejects(load('overtime-approval.service').overtimeApprovalService.approveOvertime('attendance', 60), /not eligible/);
  assert.equal(updates.length, 0);
});

test('full-time overtime remains approvable', async () => {
  const { load, updates } = setup('regular');
  await load('overtime-approval.service').overtimeApprovalService.approveOvertime('attendance', 60, 'Reviewed');
  assert.equal(updates[0].payload.overtime_status, 'approved');
  assert.equal(updates[0].payload.approved_overtime_minutes, 60);
});

for (const type of ['regular', 'part_time']) {
  test(`${type}: previously approved OT can be rejected and approved minutes cleared`, async () => {
    const { load, updates } = setup(type);
    await load('overtime-approval.service').overtimeApprovalService.rejectOvertime('attendance', 'Approval reversed');
    assert.equal(updates[0].payload.overtime_status, 'rejected');
    assert.equal(updates[0].payload.approved_overtime_minutes, 0);
    assert.equal(updates[0].payload.remarks, 'Approval reversed');
    assert.equal(updates[0].payload.clock_out, undefined);
  });
}

test('approval list labels legacy part-time OT for rejection', async () => {
  const { load } = setup();
  const rows = await load('overtime-approval.service').overtimeApprovalService.getOvertimeRows();
  assert.equal(rows[0].employment_type, 'part_time');
});

for (const action of ['createManualAttendance', 'updateManualAttendance']) {
  test(`${action}: part-time manual punches cannot create overtime`, async () => {
    const { load, updates } = setup();
    const payload = { user_id: 'employee', date: '2026-10-01', status: 'late_overtime',
      clock_out: '2026-10-01T10:00:00Z', is_overtime: true, minutes_overtime: 60 };
    const service = load('manual-attendance.service').manualAttendanceService;
    if (action === 'createManualAttendance') await service[action](payload);
    else await service[action]('attendance', payload);
    assert.equal(updates[0].payload.status, 'late');
    assert.equal(updates[0].payload.is_overtime, false);
    assert.equal(updates[0].payload.minutes_overtime, 0);
    assert.equal(updates[0].payload.approved_overtime_minutes, 0);
    assert.equal(updates[0].payload.clock_out, payload.clock_out);
  });
}

test('eligibility read failures stop approvals and manual writes', async () => {
  const { load, updates } = setup('part_time', { errorTable: 'employee_compensation' });
  await assert.rejects(load('overtime-approval.service').overtimeApprovalService.approveOvertime('attendance', 60), /Access denied/);
  await assert.rejects(load('manual-attendance.service').manualAttendanceService.createManualAttendance({ user_id: 'employee', date: '2026-10-01' }), /Access denied/);
  assert.equal(updates.length, 0);
});

for (const type of ['part_time', 'regular']) {
  test(`${type}: automatic clock-out creates OT only for full-time employees`, async () => {
    const { load, updates } = setup(type, { data: {
      attendance: { id: 'attendance', user_id: 'employee', date: '2026-10-01', shift_id: 'shift',
        clock_in: new Date(Date.now() - 3 * 3600000).toISOString(), clock_out: null,
        scheduled_end: new Date(Date.now() - 3600000).toISOString(), is_late: false },
      shifts: { overtime_after_minutes: 0, require_activity_log_before_clock_out: false },
    } });
    await load('attendance.service').attendanceService.clockOut('attendance');
    assert.equal(updates[0].payload.is_overtime, type === 'regular');
    assert.equal(updates[0].payload.status, type === 'regular' ? 'overtime' : 'present');
    if (type === 'part_time') {
      assert.equal(updates[0].payload.minutes_overtime, 0);
      assert.equal(updates[0].payload.approved_overtime_minutes, 0);
    } else assert.ok(updates[0].payload.minutes_overtime >= 60);
  });
}

test('approved attendance adjustments preserve part-time punches without creating overtime', async () => {
  const { load, updates } = setup('part_time', { data: {
    shifts: { start_time: '08:00:00', end_time: '17:00:00', grace_minutes: 0, overtime_after_minutes: 0 },
  } });
  await load('attendance-adjustment.service').attendanceAdjustmentService.approveRequest({
    id: 'request', user_id: 'employee', attendance: { id: 'attendance', user_id: 'employee', date: '2026-10-01', shift_id: 'shift' },
  }, { approved_clock_in: '2026-10-01T00:00:00Z', approved_clock_out: '2026-10-01T10:00:00Z',
    admin_remarks: 'Corrected punches', reviewed_by: 'admin' });
  const update = updates.find(row => row.table === 'attendance').payload;
  assert.equal(update.is_overtime, false);
  assert.equal(update.minutes_overtime, 0);
  assert.equal(update.status, 'present');
  assert.equal(update.clock_out, '2026-10-01T10:00:00Z');
});
