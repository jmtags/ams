import { supabase } from "../lib/supabase";

export type PayrollRecord = {
  id: string;
  payroll_period_id: string;
  user_id: string;
  pay_type: "monthly" | "daily" | "hourly";
  employment_type: "regular" | "part_time";
  basic_rate: number;
  daily_rate: number;
  hourly_rate: number;
  unpaid_break_minutes: number;
  total_work_days: number;
  total_work_minutes: number;
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

const holidayStatuses = ["holiday", "worked_holiday"];
const restDayStatuses = ["restday", "worked_restday"];
const holidayRestDayStatuses = ["holiday_restday", "worked_holiday_restday"];

const hasWorked = (row: any) => Boolean(row.clock_in || row.clock_out);

const getWorkedDayPayBase = (payType: string, dailyRate: number, hourlyRate: number, hoursPerDay: number) =>
  payType === "hourly" ? hourlyRate * hoursPerDay : dailyRate;

const getApplicableHoliday = (
  holidays: any[],
  date: string | null | undefined,
  locationId: string | null | undefined
) => {
  if (!date) return null;

  const matches = holidays.filter((item) => {
    if (item.holiday_date !== date) return false;
    if (!item.location_id) return true;
    if (!locationId) return false;
    return item.location_id === locationId;
  });

  return (
    matches.find((item) => item.location_id && item.location_id === locationId) ??
    matches.find((item) => !item.location_id) ??
    null
  );
};

const getUserShiftLocationId = (user: any) => user.shifts?.location_id ?? null;

const getAttendanceLocationId = (row: any, userLocationId: string | null) =>
  row.location_id ?? row.shifts?.location_id ?? userLocationId;

const getHolidayContext = (
  row: any,
  holidays: any[],
  userLocationId: string | null
) => {
  const status = String(row.status || "").toLowerCase();
  const locationId = getAttendanceLocationId(row, userLocationId);
  const holiday = getApplicableHoliday(holidays, row.date, locationId);
  const isHoliday =
    Boolean(holiday) ||
    row.is_holiday === true ||
    holidayStatuses.includes(status) ||
    holidayRestDayStatuses.includes(status);

  return {
    isHoliday,
    isRestDay:
      row.is_restday === true ||
      restDayStatuses.includes(status) ||
      holidayRestDayStatuses.includes(status),
    isPaid: holiday ? holiday.is_paid !== false : isHoliday,
  };
};

const mapPayrollRecord = (row: any): PayrollRecord => ({
  ...row,
  employment_type: row.employment_type ?? "regular",
  basic_rate: Number(row.basic_rate ?? 0),
  daily_rate: Number(row.daily_rate ?? 0),
  hourly_rate: Number(row.hourly_rate ?? 0),
  unpaid_break_minutes: Number(row.unpaid_break_minutes ?? 60),
  total_work_days: Number(row.total_work_days ?? 0),
  total_work_minutes: Number(row.total_work_minutes ?? 0),
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

const diffMinutes = (
  start: string | null | undefined,
  end: string | null | undefined
) => {
  if (!start || !end) return 0;
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) return 0;
  return Math.max(0, Math.round((endTime - startTime) / 60000));
};

const getPayrollClockIn = (row: any) => {
  if (!row.clock_in || !row.scheduled_start) return row.clock_in;

  const graceMinutes = Number(row.shifts?.grace_minutes ?? 0);
  if (graceMinutes <= 0) return row.clock_in;

  const lateMinutes = diffMinutes(row.scheduled_start, row.clock_in);
  if (lateMinutes > 0 && lateMinutes < graceMinutes) {
    return row.scheduled_start;
  }

  return row.clock_in;
};

const getAttendanceOvertimeMinutes = (row: any) => {
  const overtimeStatus = row.overtime_status ?? "pending";
  const approvedMinutes = Number(row.approved_overtime_minutes ?? 0);
  if (overtimeStatus === "approved") return approvedMinutes;
  if (overtimeStatus === "pending" || overtimeStatus === "rejected") return 0;

  const recordedMinutes = Number(row.minutes_overtime ?? 0);
  if (recordedMinutes > 0) return recordedMinutes;

  const status = String(row.status ?? "").toLowerCase();
  const markedOvertime =
    row.is_overtime === true ||
    status === "overtime" ||
    status === "late_overtime";

  if (!markedOvertime) return 0;

  const overtimeAfterMinutes = Number(row.shifts?.overtime_after_minutes ?? 0);
  const rawOvertimeMinutes = diffMinutes(row.scheduled_end, row.clock_out);
  return rawOvertimeMinutes > overtimeAfterMinutes ? rawOvertimeMinutes : 0;
};

const getAttendanceLateMinutes = (row: any) => {
  const graceMinutes = Number(row.shifts?.grace_minutes ?? 0);
  const actualLateMinutes = diffMinutes(row.scheduled_start, row.clock_in);
  if (actualLateMinutes > 0) {
    return actualLateMinutes < graceMinutes ? 0 : actualLateMinutes;
  }

  const status = String(row.status ?? "").toLowerCase();
  const markedLate =
    row.is_late === true || status === "late" || status === "late_overtime";

  if (!markedLate) return 0;

  const recordedMinutes = Number(row.minutes_late ?? 0);
  return recordedMinutes < graceMinutes ? 0 : recordedMinutes;
};

const getPartTimeBreakMinutes = (elapsedMinutes: number) => {
  if (elapsedMinutes >= 8 * 60) return 60;
  if (elapsedMinutes >= 4 * 60) return 30;
  return 0;
};

const getPartTimeAttendanceBreakMinutes = (row: any) =>
  getPartTimeBreakMinutes(diffMinutes(getPayrollClockIn(row), row.clock_out));

const getAttendanceElapsedMinutes = (row: any) => {
  const actualMinutes = diffMinutes(getPayrollClockIn(row), row.clock_out);
  if (actualMinutes > 0) return actualMinutes;
  if (row.clock_in && !row.clock_out) {
    return diffMinutes(row.scheduled_start, row.scheduled_end);
  }
  return 0;
};

const getRegularAttendanceBreakMinutes = (row: any, breakMinutes: number) => {
  if (breakMinutes <= 0) return 0;
  const elapsedMinutes = getAttendanceElapsedMinutes(row);
  return elapsedMinutes >= 4 * 60 ? breakMinutes : 0;
};

const getRegularAttendanceWorkMinutes = (
  row: any,
  breakMinutes: number,
  maxPaidMinutes: number
) => {
  const elapsedMinutes = getAttendanceElapsedMinutes(row);
  if (elapsedMinutes <= 0) return 0;

  const paidMinutes =
    elapsedMinutes -
    getRegularAttendanceBreakMinutes(row, breakMinutes) -
    Math.max(0, getAttendanceOvertimeMinutes(row));

  return Math.max(0, Math.min(maxPaidMinutes, paidMinutes));
};

const getPartTimeRegularWorkMinutes = (row: any) => {
  const elapsedMinutes = diffMinutes(getPayrollClockIn(row), row.clock_out);
  if (elapsedMinutes <= 0) return 0;

  return Math.max(
    0,
    elapsedMinutes -
      getPartTimeBreakMinutes(elapsedMinutes) -
      Math.max(0, getAttendanceOvertimeMinutes(row))
  );
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
      holidaysRes,
      settingsRes,
      adjustmentsRes,
      recurringRes,
    ] = await Promise.all([
      supabase.from("users").select("*, shifts ( location_id )").order("name"),
      supabase.from("employee_compensation").select("*").eq("is_active", true),
      supabase
        .from("attendance")
        .select("*, shifts ( grace_minutes, overtime_after_minutes )")
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
      supabase
        .from("holidays")
        .select("id, holiday_date, location_id, is_paid")
        .gte("holiday_date", period.date_from)
        .lte("holiday_date", period.date_to),
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
    if (holidaysRes.error) throw holidaysRes.error;
    if (settingsRes.error) throw settingsRes.error;
    if (adjustmentsRes.error) throw adjustmentsRes.error;
    if (recurringRes.error) throw recurringRes.error;

    const users = usersRes.data ?? [];
    const compensations = compensationRes.data ?? [];
    const attendanceRows = attendanceRes.data ?? [];
    const leaveRows = leaveRes.data ?? [];
    const holidays = holidaysRes.data ?? [];
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
    const restDayMultiplier = Number(settings?.restday_multiplier ?? 1.3);
    const holidayMultiplier = Number(settings?.holiday_multiplier ?? 2);
    const holidayRestDayMultiplier = Number(
      settings?.holiday_restday_multiplier ?? 2.6
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
    const holidayPayQuantityByUser = new Map<string, number>();

    for (const user of users) {
      const comp = compensationByUser.get(user.id);
      if (!comp) continue;

      const userAttendance = attendanceByUser.get(user.id) ?? [];
      const userLeaves = leaveByUser.get(user.id) ?? [];
      const userAdjustments = adjustmentsByUser.get(user.id) ?? [];
      const userRecurring = recurringByUser.get(user.id) ?? [];
      const userLocationId = getUserShiftLocationId(user);

      const workedDays = userAttendance.filter((row) =>
        workedStatuses.includes(row.status)
      ).length;

      const absentDays = userAttendance.filter(
        (row) => row.status === "absent"
      ).length;

      const rawLateMinutes = userAttendance.reduce(
        (sum, row) => {
          const minutesLate = getAttendanceLateMinutes(row);
          return minutesLate > 0 ? sum + minutesLate : sum;
        },
        0
      );

      const overtimeMinutes = userAttendance.reduce(
        (sum, row) => sum + getAttendanceOvertimeMinutes(row),
        0
      );

      let paidLeaveDays = 0;
      let unpaidLeaveDays = 0;
      const payrollLeaveDates = new Set<string>();

      userLeaves.forEach((row: any) => {
        const leaveType = row.leave_requests?.leave_types;
        const countsForPayroll = leaveType?.counts_for_payroll === true;
        const isPaid = leaveType?.is_paid === true;
        const dayValue = Number(row.day_value ?? 1);

        if (countsForPayroll) {
          payrollLeaveDates.add(row.leave_date);
        }

        if (countsForPayroll && isPaid) {
          paidLeaveDays += dayValue;
        } else if (countsForPayroll) {
          unpaidLeaveDays += dayValue;
        }
      });

      const attendanceHolidayDates = new Set(
        userAttendance
          .filter((row) => getHolidayContext(row, holidays, userLocationId).isHoliday)
          .map((row) => row.date)
          .filter(Boolean)
      );

      const paidHolidayDates = new Set(
        holidays
          .filter((holiday) => holiday.is_paid !== false)
          .filter((holiday) =>
            Boolean(
              getApplicableHoliday(
                holidays,
                holiday.holiday_date,
                userLocationId
              )?.id === holiday.id
            )
          )
          .map((holiday) => holiday.holiday_date)
      );

      const paidHolidayDaysWithoutAttendance = Array.from(paidHolidayDates).filter(
        (date) => !attendanceHolidayDates.has(date) && !payrollLeaveDates.has(date)
      ).length;

      const payType = comp.pay_type as "monthly" | "daily" | "hourly";
      const employmentType =
        comp.employment_type === "part_time" ? "part_time" : "regular";
      const unpaidBreakMinutes = Math.max(
        0,
        Number(comp.unpaid_break_minutes ?? 60)
      );
      const lateMinutes = employmentType === "regular" ? rawLateMinutes : 0;
      const basicMonthlyRate = Number(comp.basic_monthly_rate ?? 0);
      const dailyRate =
        Number(comp.daily_rate ?? 0) ||
        (basicMonthlyRate > 0 ? basicMonthlyRate / defaultWorkingDays : 0);
      const hourlyRate =
        Number(comp.hourly_rate ?? 0) ||
        (dailyRate > 0 ? dailyRate / defaultHoursPerDay : 0);
      const overtimeHourlyRate = hourlyRate * regularOtMultiplier;
      const allowancePay = Number(comp.allowance_amount ?? 0);
      const regularPaidMinutesPerDay = defaultHoursPerDay * 60;

      let basicPay = 0;
      let leavePay = 0;
      let absentDeduction = 0;
      let workMinutes = 0;
      let breakMinutes = 0;

      if (employmentType === "part_time") {
        workMinutes = userAttendance.reduce(
          (sum, row) =>
            workedStatuses.includes(row.status)
              ? sum + getPartTimeRegularWorkMinutes(row)
              : sum,
          0
        );
        breakMinutes = userAttendance.reduce(
          (sum, row) =>
            workedStatuses.includes(row.status)
              ? sum + getPartTimeAttendanceBreakMinutes(row)
              : sum,
          0
        );
        basicPay = (workMinutes / 60) * hourlyRate;
        leavePay = paidLeaveDays * defaultHoursPerDay * hourlyRate;
        absentDeduction = 0;
      } else if (payType === "daily") {
        workMinutes = userAttendance.reduce(
          (sum, row) =>
            workedStatuses.includes(row.status)
              ? sum +
                getRegularAttendanceWorkMinutes(
                  row,
                  unpaidBreakMinutes,
                  regularPaidMinutesPerDay
                )
              : sum,
          0
        );
        breakMinutes = userAttendance.reduce(
          (sum, row) =>
            workedStatuses.includes(row.status)
              ? sum + getRegularAttendanceBreakMinutes(row, unpaidBreakMinutes)
              : sum,
          0
        );
        basicPay = (workMinutes / regularPaidMinutesPerDay) * dailyRate;
        leavePay = paidLeaveDays * dailyRate;
        absentDeduction = 0;
      } else if (payType === "hourly") {
        workMinutes = userAttendance.reduce(
          (sum, row) =>
            workedStatuses.includes(row.status)
              ? sum +
                getRegularAttendanceWorkMinutes(
                  row,
                  unpaidBreakMinutes,
                  regularPaidMinutesPerDay
                )
              : sum,
          0
        );
        breakMinutes = userAttendance.reduce(
          (sum, row) =>
            workedStatuses.includes(row.status)
              ? sum + getRegularAttendanceBreakMinutes(row, unpaidBreakMinutes)
              : sum,
          0
        );
        basicPay = (workMinutes / 60) * hourlyRate;
        leavePay = paidLeaveDays * defaultHoursPerDay * hourlyRate;
        absentDeduction = 0;
      } else {
        const semiMonthlyBase = basicMonthlyRate / 2;
        workMinutes = userAttendance.reduce(
          (sum, row) =>
            workedStatuses.includes(row.status)
              ? sum +
                getRegularAttendanceWorkMinutes(
                  row,
                  unpaidBreakMinutes,
                  regularPaidMinutesPerDay
                )
              : sum,
          0
        );
        breakMinutes = userAttendance.reduce(
          (sum, row) =>
            workedStatuses.includes(row.status)
              ? sum + getRegularAttendanceBreakMinutes(row, unpaidBreakMinutes)
              : sum,
          0
        );
        basicPay = semiMonthlyBase;
        leavePay = 0;
        absentDeduction = (unpaidLeaveDays + absentDays) * dailyRate;
      }

      let holidayPay = 0;
      let restDayPay = 0;
      let holidayPayQuantity = 0;
      const countedHolidayPayDates = new Set<string>();
      const dayPayBase = getWorkedDayPayBase(
        payType,
        dailyRate,
        hourlyRate,
        defaultHoursPerDay
      );

      const addHolidayPay = (
        date: string | null | undefined,
        amount: number
      ) => {
        if (amount <= 0) return;

        holidayPay += amount;

        if (date && !countedHolidayPayDates.has(date)) {
          countedHolidayPayDates.add(date);
          holidayPayQuantity += 1;
        }
      };

      userAttendance.forEach((row) => {
        const status = String(row.status || "").toLowerCase();
        const worked = hasWorked(row);
        const holidayContext = getHolidayContext(row, holidays, userLocationId);
        const paidHoliday = holidayContext.isHoliday && holidayContext.isPaid;
        const isHolidayRestDay =
          holidayRestDayStatuses.includes(status) ||
          (holidayContext.isHoliday && holidayContext.isRestDay);
        const isHolidayOnly =
          holidayStatuses.includes(status) ||
          (holidayContext.isHoliday && !holidayContext.isRestDay);
        const isRestDayOnly =
          restDayStatuses.includes(status) ||
          (!holidayContext.isHoliday && holidayContext.isRestDay);

        if (employmentType === "part_time") {
          if (!worked) return;

          const actualHours =
            getPartTimeRegularWorkMinutes(row) / 60;
          const actualBasePay = actualHours * hourlyRate;

          if (paidHoliday && isHolidayRestDay) {
            addHolidayPay(row.date, actualBasePay * (holidayRestDayMultiplier - 1));
          } else if (paidHoliday && isHolidayOnly) {
            addHolidayPay(row.date, actualBasePay * (holidayMultiplier - 1));
          } else if (isRestDayOnly) {
            restDayPay += actualBasePay * (restDayMultiplier - 1);
          }

          return;
        }

        if (paidHoliday && isHolidayRestDay) {
          addHolidayPay(row.date, worked
            ? dayPayBase * (holidayRestDayMultiplier - 1)
            : payType === "monthly"
              ? 0
              : dayPayBase);
        } else if (paidHoliday && isHolidayOnly) {
          addHolidayPay(row.date, worked
            ? dayPayBase * (holidayMultiplier - 1)
            : payType === "monthly"
              ? 0
              : dayPayBase);
        } else if (isRestDayOnly && worked) {
          restDayPay += dayPayBase * (restDayMultiplier - 1);
        }
      });

      if (employmentType === "regular" && payType !== "monthly") {
        holidayPay += paidHolidayDaysWithoutAttendance * dayPayBase;
        holidayPayQuantity += paidHolidayDaysWithoutAttendance;
      }

      if (holidayPayQuantity > 0) {
        holidayPayQuantityByUser.set(user.id, holidayPayQuantity);
      }

      const lateDeduction =
        employmentType === "regular" ? (lateMinutes / 60) * hourlyRate : 0;

      const overtimePay =
        (overtimeMinutes / 60) * overtimeHourlyRate;

      let additions = 0;
      let recurringAdditionTotal = 0;
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

        if ((ded.adjustment_type ?? "deduction") === "addition") {
          if ((ded.deduction_type ?? "fixed") === "percentage") {
            recurringAdditionTotal +=
              (basicPay + leavePay + overtimePay + holidayPay + restDayPay) *
              (amount / 100);
          } else {
            recurringAdditionTotal += amount;
          }

          return;
        }

        if ((ded.deduction_type ?? "fixed") === "percentage") {
          recurringDeductionTotal +=
            (basicPay +
              leavePay +
              overtimePay +
              holidayPay +
              restDayPay +
              allowancePay +
              additions) *
            (amount / 100);
        } else {
          recurringDeductionTotal += amount;
        }
      });

      const otherDeductions = round2(
        manualDeductionTotal + recurringDeductionTotal
      );

      const grossPay = round2(
        basicPay +
          leavePay +
          overtimePay +
          holidayPay +
          restDayPay +
          allowancePay +
          recurringAdditionTotal +
          additions
      );

      const totalDeductions = round2(
        lateDeduction + absentDeduction + otherDeductions
      );

      const netPay = round2(grossPay - totalDeductions);

      recordsToInsert.push({
        payroll_period_id: payrollPeriodId,
        user_id: user.id,
        pay_type: payType,
        employment_type: employmentType,
        basic_rate: basicMonthlyRate,
        daily_rate: dailyRate,
        hourly_rate: hourlyRate,
        unpaid_break_minutes: breakMinutes,
        total_work_days: workedDays,
        total_work_minutes: workMinutes,
        total_paid_leave_days: paidLeaveDays,
        total_unpaid_leave_days: unpaidLeaveDays,
        total_absent_days: absentDays,
        total_late_minutes: lateMinutes,
        total_overtime_minutes: overtimeMinutes,
        basic_pay: round2(basicPay),
        leave_pay: round2(leavePay),
        overtime_pay: round2(overtimePay),
        holiday_pay: round2(holidayPay),
        restday_pay: round2(restDayPay),
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
        const isPartTime = record.employment_type === "part_time";
        itemsToInsert.push({
          payroll_record_id: record.id,
          item_type: "basic_pay",
          description: isPartTime ? "Basic Pay (Part-time Hours)" : "Basic Pay",
          quantity: isPartTime
            ? round2(Number(record.total_work_minutes ?? 0) / 60)
            : record.total_work_days,
          rate: isPartTime ? record.hourly_rate : record.daily_rate,
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
          rate: round2(Number(record.hourly_rate ?? 0) * regularOtMultiplier),
          amount: record.overtime_pay,
        });
      }

      if (Number(record.holiday_pay ?? 0) > 0) {
        const holidayPayQuantity = Math.max(
          1,
          Number(holidayPayQuantityByUser.get(record.user_id) ?? 1)
        );

        itemsToInsert.push({
          payroll_record_id: record.id,
          item_type: "holiday_pay",
          description: "Holiday Pay",
          quantity: holidayPayQuantity,
          rate: round2(Number(record.holiday_pay ?? 0) / holidayPayQuantity),
          amount: record.holiday_pay,
        });
      }

      if (Number(record.restday_pay ?? 0) > 0) {
        itemsToInsert.push({
          payroll_record_id: record.id,
          item_type: "restday_pay",
          description: "Rest Day Pay",
          quantity: 1,
          rate: record.restday_pay,
          amount: record.restday_pay,
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

        if ((ded.adjustment_type ?? "deduction") === "addition") {
          const computedAmount =
            (ded.deduction_type ?? "fixed") === "percentage"
              ? round2(
                  (Number(record.basic_pay ?? 0) +
                    Number(record.leave_pay ?? 0) +
                    Number(record.overtime_pay ?? 0) +
                    Number(record.holiday_pay ?? 0) +
                    Number(record.restday_pay ?? 0)) *
                    (rawAmount / 100)
                )
              : rawAmount;

          if (computedAmount <= 0) return;

          itemsToInsert.push({
            payroll_record_id: record.id,
            item_type: "adjustment_add",
            description: ded.name || "Recurring Addition",
            quantity: 1,
            rate: computedAmount,
            amount: computedAmount,
          });

          return;
        }

        const computedAmount =
          (ded.deduction_type ?? "fixed") === "percentage"
            ? round2(
                (Number(record.basic_pay ?? 0) +
                  Number(record.leave_pay ?? 0) +
                  Number(record.overtime_pay ?? 0) +
                  Number(record.holiday_pay ?? 0) +
                  Number(record.restday_pay ?? 0) +
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

  async getMyPayrollRecords(userId: string): Promise<PayrollRecord[]> {
  const { data, error } = await supabase
    .from("payroll_records")
    .select(`
      *,
      payroll_periods (
        id,
        name,
        date_from,
        date_to,
        pay_date
      )
    `)
    .eq("user_id", userId)
    .in("status", ["finalized", "released"])
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapPayrollRecord);
},
async getMyPayrollRecordDetails(recordId: string, userId: string): Promise<{
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
      .eq("user_id", userId)
      .maybeSingle(),

    supabase
      .from("payroll_record_items")
      .select(`
        *,
        payroll_records!inner (
          id,
          user_id
        )
      `)
      .eq("payroll_record_id", recordId)
      .eq("payroll_records.user_id", userId)
      .order("created_at", { ascending: true }),
  ]);

  if (recordRes.error) throw recordRes.error;
  if (itemsRes.error) throw itemsRes.error;

  return {
    record: recordRes.data ? mapPayrollRecord(recordRes.data) : null,
    items: (itemsRes.data ?? []).map(mapPayrollRecordItem),
  };
},
};
