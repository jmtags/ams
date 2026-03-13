import { supabase } from "../lib/supabase";

export type PayrollRecord = {
  id: string;
  payroll_period_id: string;
  user_id: string;
  pay_type: "monthly" | "daily" | "hourly";
  basic_rate: number;
  daily_rate: number;
  hourly_rate: number;
  total_work_days: number;
  total_paid_leave_days: number;
  total_unpaid_leave_days: number;
  total_absent_days: number;
  total_late_minutes: number;
  total_overtime_minutes: number;
  basic_pay: number;
  leave_pay: number;
  overtime_pay: number;
  holiday_pay: number;
  restday_pay: number;
  allowance_pay: number;
  gross_pay: number;
  late_deduction: number;
  undertime_deduction: number;
  absent_deduction: number;
  sss_deduction: number;
  pagibig_deduction: number;
  philhealth_deduction: number;
  tax_deduction: number;
  other_deductions: number;
  total_deductions: number;
  net_pay: number;
  remarks: string | null;
  status: "draft" | "computed" | "reviewed" | "finalized" | "released";
  generated_at: string | null;
  finalized_at: string | null;
  released_at: string | null;
  created_at?: string;
  updated_at?: string;

  user_name?: string;
  user_email?: string | null;

  payroll_period_name?: string;
  payroll_period_date_from?: string | null;
  payroll_period_date_to?: string | null;
  payroll_period_pay_date?: string | null;
};

export type PayrollRecordItem = {
  id: string;
  payroll_record_id: string;
  item_type:
    | "basic_pay"
    | "leave_pay"
    | "overtime_pay"
    | "holiday_pay"
    | "restday_pay"
    | "allowance"
    | "late_deduction"
    | "undertime_deduction"
    | "absent_deduction"
    | "sss_deduction"
    | "pagibig_deduction"
    | "philhealth_deduction"
    | "tax_deduction"
    | "other_deduction"
    | "adjustment_add"
    | "adjustment_less";
  description: string;
  quantity: number;
  rate: number;
  amount: number;
  created_at?: string;
};

const round2 = (value: number) => Math.round(value * 100) / 100;

const workedStatuses = [
  "present",
  "late",
  "overtime",
  "late_overtime",
  "worked_holiday",
  "worked_restday",
  "worked_holiday_restday",
];

const mapPayrollRecord = (row: any): PayrollRecord => ({
  ...row,
  basic_rate: Number(row.basic_rate ?? 0),
  daily_rate: Number(row.daily_rate ?? 0),
  hourly_rate: Number(row.hourly_rate ?? 0),
  total_work_days: Number(row.total_work_days ?? 0),
  total_paid_leave_days: Number(row.total_paid_leave_days ?? 0),
  total_unpaid_leave_days: Number(row.total_unpaid_leave_days ?? 0),
  total_absent_days: Number(row.total_absent_days ?? 0),
  total_late_minutes: Number(row.total_late_minutes ?? 0),
  total_overtime_minutes: Number(row.total_overtime_minutes ?? 0),
  basic_pay: Number(row.basic_pay ?? 0),
  leave_pay: Number(row.leave_pay ?? 0),
  overtime_pay: Number(row.overtime_pay ?? 0),
  holiday_pay: Number(row.holiday_pay ?? 0),
  restday_pay: Number(row.restday_pay ?? 0),
  allowance_pay: Number(row.allowance_pay ?? 0),
  gross_pay: Number(row.gross_pay ?? 0),
  late_deduction: Number(row.late_deduction ?? 0),
  undertime_deduction: Number(row.undertime_deduction ?? 0),
  absent_deduction: Number(row.absent_deduction ?? 0),
  sss_deduction: Number(row.sss_deduction ?? 0),
  pagibig_deduction: Number(row.pagibig_deduction ?? 0),
  philhealth_deduction: Number(row.philhealth_deduction ?? 0),
  tax_deduction: Number(row.tax_deduction ?? 0),
  other_deductions: Number(row.other_deductions ?? 0),
  total_deductions: Number(row.total_deductions ?? 0),
  net_pay: Number(row.net_pay ?? 0),
  user_name: row.users?.name ?? "",
  user_email: row.users?.email ?? null,
  payroll_period_name: row.payroll_periods?.name ?? "",
  payroll_period_date_from: row.payroll_periods?.date_from ?? null,
  payroll_period_date_to: row.payroll_periods?.date_to ?? null,
  payroll_period_pay_date: row.payroll_periods?.pay_date ?? null,
});

const mapPayrollRecordItem = (row: any): PayrollRecordItem => ({
  id: row.id,
  payroll_record_id: row.payroll_record_id,
  item_type: row.item_type,
  description: row.description,
  quantity: Number(row.quantity ?? 0),
  rate: Number(row.rate ?? 0),
  amount: Number(row.amount ?? 0),
  created_at: row.created_at,
});

const isDateWithinRange = (
  value: string | null | undefined,
  from: string,
  to: string
) => {
  if (!value) return false;
  return value >= from && value <= to;
};

const overlapsDateRange = (
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  rangeStart: string,
  rangeEnd: string
) => {
  const start = startDate ?? rangeStart;
  const end = endDate ?? "9999-12-31";
  return start <= rangeEnd && end >= rangeStart;
};

const getDayOfMonth = (dateString: string) => {
  return Number(dateString.slice(8, 10));
};

const appliesRecurringDeductionToPeriod = (
  deduction: any,
  periodFrom: string,
  periodTo: string
) => {
  if (!deduction?.is_active) return false;

  if (
    !overlapsDateRange(
      deduction.start_date,
      deduction.end_date,
      periodFrom,
      periodTo
    )
  ) {
    return false;
  }

  const frequency = deduction.frequency ?? "every_payroll";

  if (frequency === "every_payroll") {
    return true;
  }

  if (frequency === "monthly_first_half") {
    return getDayOfMonth(periodTo) <= 15;
  }

  if (frequency === "monthly_second_half") {
    return getDayOfMonth(periodFrom) >= 16 || getDayOfMonth(periodTo) > 15;
  }

  if (frequency === "one_time") {
    return isDateWithinRange(deduction.start_date, periodFrom, periodTo);
  }

  return false;
};

export const payrollService = {
  async getRecordsByPeriod(payrollPeriodId: string): Promise<PayrollRecord[]> {
    const { data, error } = await supabase
      .from("payroll_records")
      .select(`
        *,
        users (
          id,
          name,
          email
        ),
        payroll_periods (
          id,
          name,
          date_from,
          date_to,
          pay_date
        )
      `)
      .eq("payroll_period_id", payrollPeriodId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []).map(mapPayrollRecord);
  },

  async getRecordDetails(recordId: string): Promise<{
    record: PayrollRecord | null;
    items: PayrollRecordItem[];
  }> {
    const [recordRes, itemsRes] = await Promise.all([
      supabase
        .from("payroll_records")
        .select(`
          *,
          users (
            id,
            name,
            email
          ),
          payroll_periods (
            id,
            name,
            date_from,
            date_to,
            pay_date
          )
        `)
        .eq("id", recordId)
        .maybeSingle(),

      supabase
        .from("payroll_record_items")
        .select("*")
        .eq("payroll_record_id", recordId)
        .order("created_at", { ascending: true }),
    ]);

    if (recordRes.error) throw recordRes.error;
    if (itemsRes.error) throw itemsRes.error;

    return {
      record: recordRes.data ? mapPayrollRecord(recordRes.data) : null,
      items: (itemsRes.data ?? []).map(mapPayrollRecordItem),
    };
  },

  async generatePayroll(payrollPeriodId: string): Promise<void> {
    const { data: period, error: periodError } = await supabase
      .from("payroll_periods")
      .select("*")
      .eq("id", payrollPeriodId)
      .single();

    if (periodError || !period) {
      throw new Error("Payroll period not found.");
    }

    await supabase
      .from("payroll_periods")
      .update({
        status: "processing",
        updated_at: new Date().toISOString(),
      })
      .eq("id", payrollPeriodId);

    const [
      usersRes,
      compensationRes,
      attendanceRes,
      leaveRes,
      settingsRes,
      adjustmentsRes,
      recurringRes,
    ] = await Promise.all([
      supabase.from("users").select("*").order("name"),
      supabase.from("employee_compensation").select("*").eq("is_active", true),
      supabase
        .from("attendance")
        .select("*")
        .gte("date", period.date_from)
        .lte("date", period.date_to),
      supabase
        .from("leave_request_dates")
        .select(`
          *,
          leave_requests!inner (
            id,
            user_id,
            status,
            leave_type_id,
            leave_types (
              id,
              name,
              code,
              is_paid,
              counts_for_payroll
            )
          )
        `)
        .gte("leave_date", period.date_from)
        .lte("leave_date", period.date_to)
        .eq("leave_requests.status", "approved"),
      supabase.from("payroll_settings").select("*").limit(1).maybeSingle(),
      supabase
        .from("payroll_adjustments")
        .select("*")
        .eq("payroll_period_id", payrollPeriodId),
      supabase
        .from("employee_recurring_deductions")
        .select("*")
        .eq("is_active", true),
    ]);

    if (usersRes.error) throw usersRes.error;
    if (compensationRes.error) throw compensationRes.error;
    if (attendanceRes.error) throw attendanceRes.error;
    if (leaveRes.error) throw leaveRes.error;
    if (settingsRes.error) throw settingsRes.error;
    if (adjustmentsRes.error) throw adjustmentsRes.error;
    if (recurringRes.error) throw recurringRes.error;

    const users = usersRes.data ?? [];
    const compensations = compensationRes.data ?? [];
    const attendanceRows = attendanceRes.data ?? [];
    const leaveRows = leaveRes.data ?? [];
    const settings = settingsRes.data;
    const adjustments = adjustmentsRes.data ?? [];
    const recurringDeductions = recurringRes.data ?? [];

    const defaultWorkingDays = Number(
      settings?.default_working_days_per_month ?? 22
    );
    const defaultHoursPerDay = Number(settings?.default_hours_per_day ?? 8);
    const regularOtMultiplier = Number(
      settings?.overtime_multiplier_regular ?? 1.25
    );

    const compensationByUser = new Map<string, any>();
    compensations.forEach((row: any) => {
      const existing = compensationByUser.get(row.user_id);
      if (!existing) {
        compensationByUser.set(row.user_id, row);
        return;
      }

      if ((row.effective_from ?? "") > (existing.effective_from ?? "")) {
        compensationByUser.set(row.user_id, row);
      }
    });

    const attendanceByUser = new Map<string, any[]>();
    attendanceRows.forEach((row: any) => {
      const existing = attendanceByUser.get(row.user_id) ?? [];
      existing.push(row);
      attendanceByUser.set(row.user_id, existing);
    });

    const leaveByUser = new Map<string, any[]>();
    leaveRows.forEach((row: any) => {
      const userId = row.leave_requests?.user_id;
      if (!userId) return;
      const existing = leaveByUser.get(userId) ?? [];
      existing.push(row);
      leaveByUser.set(userId, existing);
    });

    const adjustmentsByUser = new Map<string, any[]>();
    adjustments.forEach((row: any) => {
      const existing = adjustmentsByUser.get(row.user_id) ?? [];
      existing.push(row);
      adjustmentsByUser.set(row.user_id, existing);
    });

    const recurringByUser = new Map<string, any[]>();
    recurringDeductions.forEach((row: any) => {
      if (
        !appliesRecurringDeductionToPeriod(row, period.date_from, period.date_to)
      ) {
        return;
      }
      const existing = recurringByUser.get(row.user_id) ?? [];
      existing.push(row);
      recurringByUser.set(row.user_id, existing);
    });

    const recordsToInsert: any[] = [];

    for (const user of users) {
      const comp = compensationByUser.get(user.id);
      if (!comp) continue;

      const userAttendance = attendanceByUser.get(user.id) ?? [];
      const userLeaves = leaveByUser.get(user.id) ?? [];
      const userAdjustments = adjustmentsByUser.get(user.id) ?? [];
      const userRecurring = recurringByUser.get(user.id) ?? [];

      const workedDays = userAttendance.filter((row) =>
        workedStatuses.includes(row.status)
      ).length;

      const absentDays = userAttendance.filter(
        (row) => row.status === "absent"
      ).length;

      const lateMinutes = userAttendance.reduce(
        (sum, row) => sum + Number(row.minutes_late ?? 0),
        0
      );

      const overtimeMinutes = userAttendance.reduce(
        (sum, row) =>
          sum + Number(row.approved_overtime_minutes ?? row.minutes_overtime ?? 0),
        0
      );

      let paidLeaveDays = 0;
      let unpaidLeaveDays = 0;

      userLeaves.forEach((row: any) => {
        const leaveType = row.leave_requests?.leave_types;
        const countsForPayroll = leaveType?.counts_for_payroll ?? true;
        const isPaid = leaveType?.is_paid ?? true;
        const dayValue = Number(row.day_value ?? 1);

        if (!countsForPayroll) return;

        if (isPaid) {
          paidLeaveDays += dayValue;
        } else {
          unpaidLeaveDays += dayValue;
        }
      });

      const payType = comp.pay_type as "monthly" | "daily" | "hourly";
      const basicMonthlyRate = Number(comp.basic_monthly_rate ?? 0);
      const dailyRate =
        Number(comp.daily_rate ?? 0) ||
        (basicMonthlyRate > 0 ? basicMonthlyRate / defaultWorkingDays : 0);
      const hourlyRate =
        Number(comp.hourly_rate ?? 0) ||
        (dailyRate > 0 ? dailyRate / defaultHoursPerDay : 0);
      const overtimeHourlyRate =
        Number(comp.overtime_hourly_rate ?? 0) || hourlyRate;
      const allowancePay = Number(comp.allowance_amount ?? 0);

      let basicPay = 0;
      let leavePay = 0;
      let absentDeduction = 0;

      if (payType === "daily") {
        basicPay = workedDays * dailyRate;
        leavePay = paidLeaveDays * dailyRate;
        absentDeduction = (unpaidLeaveDays + absentDays) * dailyRate;
      } else if (payType === "hourly") {
        basicPay = workedDays * defaultHoursPerDay * hourlyRate;
        leavePay = paidLeaveDays * defaultHoursPerDay * hourlyRate;
        absentDeduction =
          (unpaidLeaveDays + absentDays) * defaultHoursPerDay * hourlyRate;
      } else {
        const semiMonthlyBase = basicMonthlyRate / 2;
        basicPay = semiMonthlyBase;
        leavePay = 0;
        absentDeduction = (unpaidLeaveDays + absentDays) * dailyRate;
      }

      let lateDeduction = 0;
      if (comp.late_deduction_mode === "per_minute") {
        lateDeduction = lateMinutes * Number(comp.late_deduction_rate ?? 0);
      } else if (comp.late_deduction_mode === "per_hour") {
        lateDeduction =
          (lateMinutes / 60) * Number(comp.late_deduction_rate ?? 0);
      } else if (comp.late_deduction_mode === "fixed") {
        lateDeduction = Number(comp.late_deduction_rate ?? 0);
      }

      const overtimePay =
        (overtimeMinutes / 60) * overtimeHourlyRate * regularOtMultiplier;

      let additions = 0;
      let recurringDeductionTotal = 0;
      let manualDeductionTotal = 0;

      userAdjustments.forEach((adj: any) => {
        const amount = Number(adj.amount ?? 0);
        if (amount <= 0) return;

        if (adj.adjustment_type === "addition") {
          additions += amount;
        } else {
          manualDeductionTotal += amount;
        }
      });

      userRecurring.forEach((ded: any) => {
        const amount = Number(ded.amount ?? 0);
        if (amount <= 0) return;

        if ((ded.deduction_type ?? "fixed") === "percentage") {
          recurringDeductionTotal +=
            (basicPay + leavePay + overtimePay + allowancePay + additions) *
            (amount / 100);
        } else {
          recurringDeductionTotal += amount;
        }
      });

      const otherDeductions = round2(
        manualDeductionTotal + recurringDeductionTotal
      );

      const grossPay = round2(
        basicPay + leavePay + overtimePay + allowancePay + additions
      );

      const totalDeductions = round2(
        lateDeduction + absentDeduction + otherDeductions
      );

      const netPay = round2(grossPay - totalDeductions);

      recordsToInsert.push({
        payroll_period_id: payrollPeriodId,
        user_id: user.id,
        pay_type: payType,
        basic_rate: basicMonthlyRate,
        daily_rate: dailyRate,
        hourly_rate: hourlyRate,
        total_work_days: workedDays,
        total_paid_leave_days: paidLeaveDays,
        total_unpaid_leave_days: unpaidLeaveDays,
        total_absent_days: absentDays,
        total_late_minutes: lateMinutes,
        total_overtime_minutes: overtimeMinutes,
        basic_pay: round2(basicPay),
        leave_pay: round2(leavePay),
        overtime_pay: round2(overtimePay),
        holiday_pay: 0,
        restday_pay: 0,
        allowance_pay: round2(allowancePay),
        gross_pay: grossPay,
        late_deduction: round2(lateDeduction),
        undertime_deduction: 0,
        absent_deduction: round2(absentDeduction),
        sss_deduction: 0,
        pagibig_deduction: 0,
        philhealth_deduction: 0,
        tax_deduction: 0,
        other_deductions: otherDeductions,
        total_deductions: totalDeductions,
        net_pay: netPay,
        remarks: null,
        status: "computed",
        generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    const { data: existingRecords, error: existingRecordsError } = await supabase
      .from("payroll_records")
      .select("id")
      .eq("payroll_period_id", payrollPeriodId);

    if (existingRecordsError) throw existingRecordsError;

    const existingIds = (existingRecords ?? []).map((row: any) => row.id);

    if (existingIds.length > 0) {
      const { error: deleteItemsError } = await supabase
        .from("payroll_record_items")
        .delete()
        .in("payroll_record_id", existingIds);

      if (deleteItemsError) throw deleteItemsError;
    }

    const { error: deleteRecordsError } = await supabase
      .from("payroll_records")
      .delete()
      .eq("payroll_period_id", payrollPeriodId);

    if (deleteRecordsError) throw deleteRecordsError;

    if (recordsToInsert.length === 0) {
      await supabase
        .from("payroll_periods")
        .update({
          status: "processed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", payrollPeriodId);
      return;
    }

    const { data: insertedRecords, error: insertRecordsError } = await supabase
      .from("payroll_records")
      .insert(recordsToInsert)
      .select("*");

    if (insertRecordsError) throw insertRecordsError;

    const itemsToInsert: any[] = [];

    insertedRecords?.forEach((record: any) => {
      const originalUserAdjustments =
        adjustmentsByUser.get(record.user_id) ?? [];
      const originalRecurringDeductions =
        recurringByUser.get(record.user_id) ?? [];

      if (Number(record.basic_pay ?? 0) > 0) {
        itemsToInsert.push({
          payroll_record_id: record.id,
          item_type: "basic_pay",
          description: "Basic Pay",
          quantity: record.total_work_days,
          rate: record.daily_rate,
          amount: record.basic_pay,
        });
      }

      if (Number(record.leave_pay ?? 0) > 0) {
        itemsToInsert.push({
          payroll_record_id: record.id,
          item_type: "leave_pay",
          description: "Paid Leave",
          quantity: record.total_paid_leave_days,
          rate: record.daily_rate,
          amount: record.leave_pay,
        });
      }

      if (Number(record.overtime_pay ?? 0) > 0) {
        itemsToInsert.push({
          payroll_record_id: record.id,
          item_type: "overtime_pay",
          description: "Overtime Pay",
          quantity: Number(record.total_overtime_minutes ?? 0) / 60,
          rate: record.hourly_rate,
          amount: record.overtime_pay,
        });
      }

      if (Number(record.allowance_pay ?? 0) > 0) {
        itemsToInsert.push({
          payroll_record_id: record.id,
          item_type: "allowance",
          description: "Allowance",
          quantity: 1,
          rate: record.allowance_pay,
          amount: record.allowance_pay,
        });
      }

      if (Number(record.late_deduction ?? 0) > 0) {
        itemsToInsert.push({
          payroll_record_id: record.id,
          item_type: "late_deduction",
          description: "Late Deduction",
          quantity: record.total_late_minutes,
          rate: 1,
          amount: record.late_deduction,
        });
      }

      if (Number(record.absent_deduction ?? 0) > 0) {
        itemsToInsert.push({
          payroll_record_id: record.id,
          item_type: "absent_deduction",
          description: "Absent / Unpaid Leave Deduction",
          quantity:
            Number(record.total_absent_days ?? 0) +
            Number(record.total_unpaid_leave_days ?? 0),
          rate: record.daily_rate,
          amount: record.absent_deduction,
        });
      }

      originalUserAdjustments.forEach((adj: any) => {
        const amount = Number(adj.amount ?? 0);
        if (amount <= 0) return;

        itemsToInsert.push({
          payroll_record_id: record.id,
          item_type:
            adj.adjustment_type === "addition"
              ? "adjustment_add"
              : "adjustment_less",
          description: adj.name || "Payroll Adjustment",
          quantity: 1,
          rate: amount,
          amount,
        });
      });

      originalRecurringDeductions.forEach((ded: any) => {
        const rawAmount = Number(ded.amount ?? 0);
        if (rawAmount <= 0) return;

        const computedAmount =
          (ded.deduction_type ?? "fixed") === "percentage"
            ? round2(
                (Number(record.basic_pay ?? 0) +
                  Number(record.leave_pay ?? 0) +
                  Number(record.overtime_pay ?? 0) +
                  Number(record.allowance_pay ?? 0)) *
                  (rawAmount / 100)
              )
            : rawAmount;

        if (computedAmount <= 0) return;

        itemsToInsert.push({
          payroll_record_id: record.id,
          item_type: "other_deduction",
          description: ded.name || "Recurring Deduction",
          quantity: 1,
          rate: computedAmount,
          amount: computedAmount,
        });
      });
    });

    if (itemsToInsert.length > 0) {
      const { error: insertItemsError } = await supabase
        .from("payroll_record_items")
        .insert(itemsToInsert);

      if (insertItemsError) throw insertItemsError;
    }

    await supabase
      .from("payroll_periods")
      .update({
        status: "processed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", payrollPeriodId);
  },

  async finalizePayroll(payrollPeriodId: string): Promise<void> {
    const nowIso = new Date().toISOString();

    const { error: recordsError } = await supabase
      .from("payroll_records")
      .update({
        status: "finalized",
        finalized_at: nowIso,
        updated_at: nowIso,
      })
      .eq("payroll_period_id", payrollPeriodId);

    if (recordsError) throw recordsError;

    const { error: periodError } = await supabase
      .from("payroll_periods")
      .update({
        status: "finalized",
        updated_at: nowIso,
      })
      .eq("id", payrollPeriodId);

    if (periodError) throw periodError;
  },
};