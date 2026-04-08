import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

type ReviewType = "attendance" | "payroll_precheck" | "employee_audit";
type Severity = "low" | "medium" | "high";

type EmployeeRow = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  department_id?: string | null;
  role?: string | null;
};

type AttendanceRow = {
  id: string;
  user_id: string;
  date: string;
  clock_in?: string | null;
  clock_out?: string | null;
  status?: string | null;
  location_id?: string | null;
  shift_id?: string | null;
  scheduled_start?: string | null;
  scheduled_end?: string | null;
  minutes_late?: number | null;
  minutes_overtime?: number | null;
  is_late?: boolean | null;
  is_overtime?: boolean | null;
  is_absent?: boolean | null;
  is_holiday?: boolean | null;
  is_restday?: boolean | null;
  holiday_name?: string | null;
  remarks?: string | null;
  approved_overtime_minutes?: number | null;
  overtime_status?: string | null;
};

type ShiftRow = {
  id: string;
  start_time?: string | null;
  end_time?: string | null;
  grace_minutes?: number | null;
  overtime_after_minutes?: number | null;
  location_id?: string | null;
  is_active?: boolean | null;
};

type LeaveRequestDateRow = {
  id?: string;
  leave_request_id: string;
  user_id: string;
  leave_date: string;
};

type LeaveRequestRow = {
  id: string;
  status?: string | null;
  leave_type_id?: string | null;
  remarks?: string | null;
};

type RuleFinding = {
  finding_ref: string;
  category: string;
  severity: Severity;
  title: string;
  explanation: string;
  recommended_action: string;
  confidence: number;
  employee_id: string | null;
  attendance_id: string | null;
  leave_request_id: string | null;
  activity_log_id: string | null;
  source_refs: string[];
  source_data: Record<string, unknown>;
};

type AIResponse = {
  summary: string;
  payroll_risk: Severity;
  findings: Array<{
    finding_ref: string;
    severity: Severity;
    title: string;
    explanation: string;
    recommended_action: string;
    confidence: number;
  }>;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";
const OPENAI_MODEL = Deno.env.get("OPENAI_MODEL") || "gpt-5.4-mini";

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Method not allowed" }, 405);
  }

  try {
    const caller = await requirePrivilegedUser(req);

    const body = await req.json().catch(() => ({}));

    const review_type: ReviewType = body.review_type || "payroll_precheck";
    const date_from: string = body.date_from;
    const date_to: string = body.date_to;
    const employee_id: string | null = body.employee_id ?? null;
    const department_id: string | null = body.department_id ?? null;
    const location_id: string | null = body.location_id ?? null;

    if (!date_from || !date_to) {
      return jsonResponse(
        { success: false, error: "date_from and date_to are required" },
        400,
      );
    }

    if (!["attendance", "payroll_precheck", "employee_audit"].includes(review_type)) {
      return jsonResponse(
        { success: false, error: "Invalid review_type" },
        400,
      );
    }

    const employees = await fetchEmployees({ employee_id, department_id });
    const employeeIds = employees.map((e) => e.id);

    const employeeMap = new Map<string, EmployeeRow>();
    for (const emp of employees) employeeMap.set(emp.id, emp);

    let attendances: AttendanceRow[] = [];
    let shifts: ShiftRow[] = [];
    let leaveRequestDates: LeaveRequestDateRow[] = [];
    let leaveRequests: LeaveRequestRow[] = [];
    let rawActivityLogs: Record<string, unknown>[] = [];

    if (employeeIds.length > 0) {
      attendances = await fetchAttendances({
        employeeIds,
        date_from,
        date_to,
        location_id,
      });

      const shiftIds = [...new Set(attendances.map((a) => a.shift_id).filter(Boolean) as string[])];
      if (shiftIds.length > 0) {
        shifts = await fetchShifts(shiftIds);
      }

      leaveRequestDates = await fetchLeaveRequestDates({
        employeeIds,
        date_from,
        date_to,
      });

      const leaveRequestIds = [
        ...new Set(leaveRequestDates.map((r) => r.leave_request_id).filter(Boolean)),
      ] as string[];

      if (leaveRequestIds.length > 0) {
        leaveRequests = await fetchLeaveRequests(leaveRequestIds);
      }

      rawActivityLogs = await tryFetchActivityLogs(date_from, date_to);
    }

    const shiftMap = new Map<string, ShiftRow>();
    for (const s of shifts) shiftMap.set(s.id, s);

    const leaveRequestMap = new Map<string, LeaveRequestRow>();
    for (const lr of leaveRequests) leaveRequestMap.set(lr.id, lr);

    const ruleFindings = buildDeterministicFindings({
      employeeMap,
      attendances,
      shiftMap,
      leaveRequestDates,
      leaveRequestMap,
      rawActivityLogs,
    });

    const summaryStats = buildSummaryStats({
      employees,
      attendances,
      leaveRequestDates,
      rawActivityLogs,
      ruleFindings,
    });

    let aiSummary = buildFallbackSummary(summaryStats, ruleFindings);
    let payrollRisk: Severity = aiSummary.payroll_risk;
    let finalFindings = [...ruleFindings];
    let aiRaw: Record<string, unknown> | null = null;
    let modelName = "rules-only";

    if (OPENAI_API_KEY && ruleFindings.length > 0) {
      try {
        const aiResult = await getAISummary({
          review_type,
          date_from,
          date_to,
          employee_id,
          department_id,
          location_id,
          summaryStats,
          ruleFindings,
        });

        aiRaw = aiResult.raw;
        modelName = OPENAI_MODEL;
        payrollRisk = aiResult.parsed.payroll_risk;
        aiSummary = {
          summary: aiResult.parsed.summary,
          payroll_risk: aiResult.parsed.payroll_risk,
        };

        const overrideMap = new Map(
          aiResult.parsed.findings.map((f) => [f.finding_ref, f]),
        );

        finalFindings = ruleFindings.map((f) => {
          const override = overrideMap.get(f.finding_ref);
          if (!override) return f;

          return {
            ...f,
            severity: override.severity ?? f.severity,
            title: override.title?.trim() || f.title,
            explanation: override.explanation?.trim() || f.explanation,
            recommended_action:
              override.recommended_action?.trim() || f.recommended_action,
            confidence:
              typeof override.confidence === "number" ? override.confidence : f.confidence,
          };
        });
      } catch (aiError) {
        console.error("AI summary failed. Falling back to rules-only:", aiError);
      }
    }

    const counts = {
      total: finalFindings.length,
      high: finalFindings.filter((f) => f.severity === "high").length,
      medium: finalFindings.filter((f) => f.severity === "medium").length,
      low: finalFindings.filter((f) => f.severity === "low").length,
    };

    const { data: runRow, error: runError } = await admin
      .from("ai_review_runs")
      .insert({
        created_by: caller.user.id,
        review_type,
        date_from,
        date_to,
        employee_id,
        department_id,
        location_id,
        status: "completed",
        payroll_risk: payrollRisk,
        summary: aiSummary.summary,
        model_name: modelName,
        raw_result: {
          review_type,
          date_from,
          date_to,
          summary_stats: summaryStats,
          rules_only_findings: ruleFindings,
          final_findings: finalFindings,
          ai_raw: aiRaw,
        },
        total_findings: counts.total,
        high_count: counts.high,
        medium_count: counts.medium,
        low_count: counts.low,
      })
      .select("*")
      .single();

    if (runError) throw runError;

    if (finalFindings.length > 0) {
      const rows = finalFindings.map((f) => ({
        run_id: runRow.id,
        employee_id: f.employee_id,
        attendance_id: f.attendance_id,
        leave_request_id: f.leave_request_id,
        activity_log_id: f.activity_log_id,
        finding_ref: f.finding_ref,
        category: f.category,
        severity: f.severity,
        title: f.title,
        explanation: f.explanation,
        recommended_action: f.recommended_action,
        confidence: f.confidence,
        source_data: f.source_data,
      }));

      const { error: findingsError } = await admin
        .from("ai_review_findings")
        .insert(rows);

      if (findingsError) throw findingsError;
    }

    return jsonResponse({
      success: true,
      run: {
        id: runRow.id,
        created_at: runRow.created_at,
        review_type: runRow.review_type,
        date_from: runRow.date_from,
        date_to: runRow.date_to,
        payroll_risk: runRow.payroll_risk,
        summary: runRow.summary,
        total_findings: runRow.total_findings,
        high_count: runRow.high_count,
        medium_count: runRow.medium_count,
        low_count: runRow.low_count,
        model_name: runRow.model_name,
      },
      findings: finalFindings,
    });
  } catch (error) {
    console.error("run-ai-payroll-review error:", error);
    return jsonResponse(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});

async function requirePrivilegedUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    throw new Error("Missing Authorization header");
  }

  const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data, error } = await anonClient.auth.getUser();
  if (error || !data.user) {
    throw new Error("Unauthorized");
  }

  const { data: profile, error: profileError } = await admin
    .from("users")
    .select("id, role, first_name, last_name, email, department_id")
    .eq("id", data.user.id)
    .single();

  if (profileError) {
    throw new Error("Unable to read user profile");
  }

  const role = String(profile.role || "").toLowerCase();
  if (!["admin", "hr", "payroll"].includes(role)) {
    throw new Error("Forbidden: only admin, HR, or payroll can access this function");
  }

  return { user: data.user, profile };
}

async function fetchEmployees(filters: {
  employee_id: string | null;
  department_id: string | null;
}): Promise<EmployeeRow[]> {
  let query = admin
    .from("users")
    .select("id, first_name, last_name, email, department_id, role")
    .order("first_name", { ascending: true });

  if (filters.employee_id) query = query.eq("id", filters.employee_id);
  if (filters.department_id) query = query.eq("department_id", filters.department_id);

  const { data, error } = await query.limit(5000);
  if (error) throw error;

  return (data || []) as EmployeeRow[];
}

async function fetchAttendances(filters: {
  employeeIds: string[];
  date_from: string;
  date_to: string;
  location_id: string | null;
}): Promise<AttendanceRow[]> {
  let query = admin
    .from("attendance")
    .select(`
      id,
      user_id,
      date,
      clock_in,
      clock_out,
      status,
      location_id,
      shift_id,
      scheduled_start,
      scheduled_end,
      minutes_late,
      minutes_overtime,
      is_late,
      is_overtime,
      is_absent,
      is_holiday,
      is_restday,
      holiday_name,
      remarks,
      approved_overtime_minutes,
      overtime_status
    `)
    .in("user_id", filters.employeeIds)
    .gte("date", filters.date_from)
    .lte("date", filters.date_to)
    .order("date", { ascending: true });

  if (filters.location_id) query = query.eq("location_id", filters.location_id);

  const { data, error } = await query.limit(20000);
  if (error) throw error;

  return (data || []) as AttendanceRow[];
}

async function fetchShifts(shiftIds: string[]): Promise<ShiftRow[]> {
  const { data, error } = await admin
    .from("shifts")
    .select("id, start_time, end_time, grace_minutes, overtime_after_minutes, location_id, is_active")
    .in("id", shiftIds);

  if (error) throw error;
  return (data || []) as ShiftRow[];
}

async function fetchLeaveRequestDates(filters: {
  employeeIds: string[];
  date_from: string;
  date_to: string;
}): Promise<LeaveRequestDateRow[]> {
  const { data, error } = await admin
    .from("leave_request_dates")
    .select("id, leave_request_id, user_id, leave_date")
    .in("user_id", filters.employeeIds)
    .gte("leave_date", filters.date_from)
    .lte("leave_date", filters.date_to)
    .limit(20000);

  if (error) throw error;
  return (data || []) as LeaveRequestDateRow[];
}

async function fetchLeaveRequests(ids: string[]): Promise<LeaveRequestRow[]> {
  const { data, error } = await admin
    .from("leave_requests")
    .select("id, status, leave_type_id, remarks")
    .in("id", ids);

  if (error) throw error;
  return (data || []) as LeaveRequestRow[];
}

async function tryFetchActivityLogs(
  date_from: string,
  date_to: string,
): Promise<Record<string, unknown>[]> {
  const start = `${date_from}T00:00:00.000Z`;
  const end = `${date_to}T23:59:59.999Z`;

  const attempts = [
    () =>
      admin
        .from("activity_logs")
        .select("*")
        .gte("created_at", start)
        .lte("created_at", end)
        .limit(1000),
    () =>
      admin
        .from("activity_logs")
        .select("*")
        .limit(1000),
  ];

  for (const attempt of attempts) {
    try {
      const { data, error } = await attempt();
      if (!error) return (data || []) as Record<string, unknown>[];
    } catch {
      // ignore
    }
  }

  return [];
}

function buildDeterministicFindings(input: {
  employeeMap: Map<string, EmployeeRow>;
  attendances: AttendanceRow[];
  shiftMap: Map<string, ShiftRow>;
  leaveRequestDates: LeaveRequestDateRow[];
  leaveRequestMap: Map<string, LeaveRequestRow>;
  rawActivityLogs: Record<string, unknown>[];
}): RuleFinding[] {
  const findings: RuleFinding[] = [];
  let seq = 1;

  const nextRef = () => `RF-${String(seq++).padStart(4, "0")}`;

  const employeeName = (userId: string | null) => {
    if (!userId) return "Unknown employee";
    const emp = input.employeeMap.get(userId);
    if (!emp) return userId;
    const name = `${emp.first_name || ""} ${emp.last_name || ""}`.trim();
    return name || emp.email || userId;
  };

  const addFinding = (finding: Omit<RuleFinding, "finding_ref">) => {
    findings.push({
      finding_ref: nextRef(),
      ...finding,
    });
  };

  const approvedLeaveKeyMap = new Map<string, LeaveRequestDateRow[]>();
  for (const lrd of input.leaveRequestDates) {
    const lr = input.leaveRequestMap.get(lrd.leave_request_id);
    const status = String(lr?.status || "").toLowerCase();
    if (status !== "approved") continue;

    const key = `${lrd.user_id}__${lrd.leave_date}`;
    const arr = approvedLeaveKeyMap.get(key) || [];
    arr.push(lrd);
    approvedLeaveKeyMap.set(key, arr);
  }

  const duplicateMap = new Map<string, AttendanceRow[]>();
  for (const a of input.attendances) {
    const key = `${a.user_id}__${a.date}`;
    const arr = duplicateMap.get(key) || [];
    arr.push(a);
    duplicateMap.set(key, arr);
  }

  for (const [key, rows] of duplicateMap.entries()) {
    if (rows.length <= 1) continue;
    const [userId, date] = key.split("__");
    addFinding({
      category: "duplicate_attendance_entries",
      severity: "high",
      title: `Duplicate attendance entries detected for ${employeeName(userId)}`,
      explanation:
        `${employeeName(userId)} has ${rows.length} attendance entries on ${date}. ` +
        `Duplicate daily entries can affect late, overtime, and payroll calculations.`,
      recommended_action:
        "Review all entries for the same employee and date, keep the valid record, and void or correct duplicates before payroll processing.",
      confidence: 0.98,
      employee_id: userId,
      attendance_id: rows[0]?.id || null,
      leave_request_id: null,
      activity_log_id: null,
      source_refs: rows.map((r) => `attendance:${r.id}`),
      source_data: {
        date,
        count: rows.length,
        attendance_ids: rows.map((r) => r.id),
      },
    });
  }

  for (const a of input.attendances) {
    const lateMinutes = Number(a.minutes_late || 0);
    const overtimeMinutes = Number(a.minutes_overtime || 0);
    const approvedOvertimeMinutes = Number(a.approved_overtime_minutes || 0);
    const overtimeStatus = String(a.overtime_status || "").toLowerCase();

    if (a.clock_in && !a.clock_out) {
      addFinding({
        category: "missing_clock_out",
        severity: "high",
        title: `Missing clock-out for ${employeeName(a.user_id)}`,
        explanation:
          `${employeeName(a.user_id)} has a clock-in record on ${a.date} but no clock-out. ` +
          `This can distort rendered hours and overtime computation.`,
        recommended_action:
          "Verify the actual end time with the employee or supervisor and correct the attendance entry before payroll cutoff.",
        confidence: 0.98,
        employee_id: a.user_id,
        attendance_id: a.id,
        leave_request_id: null,
        activity_log_id: null,
        source_refs: [`attendance:${a.id}`],
        source_data: {
          date: a.date,
          clock_in: a.clock_in,
          clock_out: a.clock_out,
          status: a.status,
        },
      });
    }

    if (!a.clock_in && a.clock_out) {
      addFinding({
        category: "missing_clock_in",
        severity: "high",
        title: `Missing clock-in for ${employeeName(a.user_id)}`,
        explanation:
          `${employeeName(a.user_id)} has a clock-out record on ${a.date} but no clock-in. ` +
          `This can distort worked hours and time-based payroll calculations.`,
        recommended_action:
          "Verify the actual start time with the employee or supervisor and correct the attendance entry before payroll cutoff.",
        confidence: 0.98,
        employee_id: a.user_id,
        attendance_id: a.id,
        leave_request_id: null,
        activity_log_id: null,
        source_refs: [`attendance:${a.id}`],
        source_data: {
          date: a.date,
          clock_in: a.clock_in,
          clock_out: a.clock_out,
          status: a.status,
        },
      });
    }

    const leaveKey = `${a.user_id}__${a.date}`;
    const approvedLeaveRows = approvedLeaveKeyMap.get(leaveKey) || [];
    if (approvedLeaveRows.length > 0 && (a.clock_in || a.clock_out)) {
      addFinding({
        category: "leave_attendance_conflict",
        severity: "high",
        title: `Attendance found on an approved leave date for ${employeeName(a.user_id)}`,
        explanation:
          `${employeeName(a.user_id)} has time logs on ${a.date}, but that same date is covered by an approved leave request. ` +
          `This should be checked to avoid incorrect leave deduction or duplicate pay treatment.`,
        recommended_action:
          "Confirm whether the employee actually worked, whether the leave should be amended, or whether the attendance entry was logged in error.",
        confidence: 0.96,
        employee_id: a.user_id,
        attendance_id: a.id,
        leave_request_id: approvedLeaveRows[0]?.leave_request_id || null,
        activity_log_id: null,
        source_refs: [
          `attendance:${a.id}`,
          ...approvedLeaveRows.map((r) => `leave_request:${r.leave_request_id}`),
        ],
        source_data: {
          date: a.date,
          leave_request_ids: approvedLeaveRows.map((r) => r.leave_request_id),
          clock_in: a.clock_in,
          clock_out: a.clock_out,
        },
      });
    }

    if (overtimeMinutes > 0 && approvedOvertimeMinutes === 0 && overtimeStatus !== "approved") {
      addFinding({
        category: "overtime_not_approved",
        severity: "medium",
        title: `Overtime worked without approval for ${employeeName(a.user_id)}`,
        explanation:
          `${employeeName(a.user_id)} has ${overtimeMinutes} overtime minutes on ${a.date}, ` +
          `but no approved overtime minutes were recorded.`,
        recommended_action:
          "Check whether overtime should be approved, adjusted, or excluded based on your overtime policy and supervisor approval.",
        confidence: 0.92,
        employee_id: a.user_id,
        attendance_id: a.id,
        leave_request_id: null,
        activity_log_id: null,
        source_refs: [`attendance:${a.id}`],
        source_data: {
          date: a.date,
          minutes_overtime: overtimeMinutes,
          approved_overtime_minutes: approvedOvertimeMinutes,
          overtime_status: a.overtime_status,
        },
      });
    }

    if (approvedOvertimeMinutes > overtimeMinutes) {
      addFinding({
        category: "approved_overtime_exceeds_actual",
        severity: "high",
        title: `Approved overtime exceeds actual overtime for ${employeeName(a.user_id)}`,
        explanation:
          `${employeeName(a.user_id)} has ${approvedOvertimeMinutes} approved overtime minutes on ${a.date}, ` +
          `but only ${overtimeMinutes} actual overtime minutes are recorded.`,
        recommended_action:
          "Review the attendance log and approval record. Adjust either the approved overtime minutes or the attendance record before payroll is finalized.",
        confidence: 0.97,
        employee_id: a.user_id,
        attendance_id: a.id,
        leave_request_id: null,
        activity_log_id: null,
        source_refs: [`attendance:${a.id}`],
        source_data: {
          date: a.date,
          minutes_overtime: overtimeMinutes,
          approved_overtime_minutes: approvedOvertimeMinutes,
          overtime_status: a.overtime_status,
        },
      });
    }

    if (approvedOvertimeMinutes > 0 && overtimeMinutes === 0) {
      addFinding({
        category: "approved_overtime_without_actual",
        severity: "high",
        title: `Approved overtime has no matching actual overtime for ${employeeName(a.user_id)}`,
        explanation:
          `${employeeName(a.user_id)} has approved overtime minutes on ${a.date}, but the attendance entry shows no actual overtime minutes.`,
        recommended_action:
          "Review the time log and overtime approval record and correct whichever record is inaccurate.",
        confidence: 0.97,
        employee_id: a.user_id,
        attendance_id: a.id,
        leave_request_id: null,
        activity_log_id: null,
        source_refs: [`attendance:${a.id}`],
        source_data: {
          date: a.date,
          minutes_overtime: overtimeMinutes,
          approved_overtime_minutes: approvedOvertimeMinutes,
          overtime_status: a.overtime_status,
        },
      });
    }

    const allowedHolidayStatuses = new Set([
      "holiday",
      "worked_holiday",
      "holiday_restday",
      "worked_holiday_restday",
    ]);

    const allowedRestdayStatuses = new Set([
      "restday",
      "worked_restday",
      "holiday_restday",
      "worked_holiday_restday",
    ]);

    const normalizedStatus = String(a.status || "").toLowerCase();

    if (a.is_holiday && !allowedHolidayStatuses.has(normalizedStatus)) {
      addFinding({
        category: "holiday_status_mismatch",
        severity: "medium",
        title: `Holiday flag/status mismatch for ${employeeName(a.user_id)}`,
        explanation:
          `${employeeName(a.user_id)} is flagged as holiday on ${a.date}, ` +
          `but the attendance status is "${a.status || "blank"}".`,
        recommended_action:
          "Confirm the holiday tagging and update the attendance status to the correct holiday-related status if needed.",
        confidence: 0.90,
        employee_id: a.user_id,
        attendance_id: a.id,
        leave_request_id: null,
        activity_log_id: null,
        source_refs: [`attendance:${a.id}`],
        source_data: {
          date: a.date,
          is_holiday: a.is_holiday,
          status: a.status,
          holiday_name: a.holiday_name,
        },
      });
    }

    if (a.is_restday && !allowedRestdayStatuses.has(normalizedStatus)) {
      addFinding({
        category: "restday_status_mismatch",
        severity: "medium",
        title: `Rest day flag/status mismatch for ${employeeName(a.user_id)}`,
        explanation:
          `${employeeName(a.user_id)} is flagged as rest day on ${a.date}, ` +
          `but the attendance status is "${a.status || "blank"}".`,
        recommended_action:
          "Confirm the rest day tagging and update the attendance status to the correct rest-day-related status if needed.",
        confidence: 0.90,
        employee_id: a.user_id,
        attendance_id: a.id,
        leave_request_id: null,
        activity_log_id: null,
        source_refs: [`attendance:${a.id}`],
        source_data: {
          date: a.date,
          is_restday: a.is_restday,
          status: a.status,
        },
      });
    }

    const shift = a.shift_id ? input.shiftMap.get(a.shift_id) : null;
    const grace = Number(shift?.grace_minutes || 0);

    if (
      lateMinutes > 0 &&
      lateMinutes >= Math.max(grace - 2, 0) &&
      lateMinutes <= grace + 3
    ) {
      // Counted later in grouped suspicious pattern section
    }
  }

  // Group suspicious repeated near-threshold lateness
  const nearThresholdByUser = new Map<string, AttendanceRow[]>();
  for (const a of input.attendances) {
    const shift = a.shift_id ? input.shiftMap.get(a.shift_id) : null;
    const grace = Number(shift?.grace_minutes || 0);
    const lateMinutes = Number(a.minutes_late || 0);

    if (
      lateMinutes > 0 &&
      lateMinutes >= Math.max(grace - 2, 0) &&
      lateMinutes <= grace + 3
    ) {
      const arr = nearThresholdByUser.get(a.user_id) || [];
      arr.push(a);
      nearThresholdByUser.set(a.user_id, arr);
    }
  }

  for (const [userId, rows] of nearThresholdByUser.entries()) {
    if (rows.length < 4) continue;

    addFinding({
      category: "repeated_near_threshold_lateness",
      severity: "medium",
      title: `Repeated near-threshold lateness pattern for ${employeeName(userId)}`,
      explanation:
        `${employeeName(userId)} has ${rows.length} attendance entries with lateness clustered near the grace threshold. ` +
        `This may indicate a pattern worth manual review.`,
      recommended_action:
        "Review the employee’s time-in pattern with the supervisor. Confirm whether the pattern is valid behavior, a scheduling issue, or requires policy coaching.",
      confidence: 0.84,
      employee_id: userId,
      attendance_id: rows[0]?.id || null,
      leave_request_id: null,
      activity_log_id: null,
      source_refs: rows.map((r) => `attendance:${r.id}`),
      source_data: {
        dates: rows.map((r) => ({
          attendance_id: r.id,
          date: r.date,
          minutes_late: r.minutes_late,
        })),
      },
    });
  }

  // Optional activity log patterns if table exists and has usable keys
  const activityFindings = buildActivityLogFindings(input.rawActivityLogs, employeeName, nextRef);
  findings.push(...activityFindings);

  return findings;
}

function buildActivityLogFindings(
  rawLogs: Record<string, unknown>[],
  employeeName: (userId: string | null) => string,
  nextRef: () => string,
): RuleFinding[] {
  if (!Array.isArray(rawLogs) || rawLogs.length === 0) return [];

  const findings: RuleFinding[] = [];

  const sample = rawLogs[0] || {};
  const keys = new Set(Object.keys(sample));

  const actorKey =
    ["actor_user_id", "user_id", "performed_by", "updated_by"].find((k) => keys.has(k)) || null;
  const targetKey =
    ["target_user_id", "employee_id", "subject_user_id"].find((k) => keys.has(k)) || null;
  const actionKey =
    ["action", "event_type", "activity", "type"].find((k) => keys.has(k)) || null;
  const createdAtKey =
    ["created_at", "timestamp", "occurred_at"].find((k) => keys.has(k)) || null;
  const idKey = ["id", "log_id"].find((k) => keys.has(k)) || null;

  if (!actorKey || !actionKey || !createdAtKey) return [];

  const attendanceEditKeywords = ["attendance", "clock", "time", "ot", "overtime"];
  const editKeywords = ["update", "edit", "modify", "approve"];

  const actorBuckets = new Map<string, Record<string, unknown>[]>();

  for (const log of rawLogs) {
    const action = String(log[actionKey] || "").toLowerCase();
    const actorId = String(log[actorKey] || "");
    const createdAt = String(log[createdAtKey] || "");

    if (!actorId || !createdAt) continue;

    const looksAttendanceRelated = attendanceEditKeywords.some((kw) => action.includes(kw));
    const looksEdit = editKeywords.some((kw) => action.includes(kw));

    if (!(looksAttendanceRelated && looksEdit)) continue;

    const arr = actorBuckets.get(actorId) || [];
    arr.push(log);
    actorBuckets.set(actorId, arr);
  }

  for (const [actorId, logs] of actorBuckets.entries()) {
    if (logs.length >= 12) {
      findings.push({
        finding_ref: nextRef(),
        category: "suspicious_edit_pattern",
        severity: "medium",
        title: `High volume of attendance-related edits detected`,
        explanation:
          `${employeeName(actorId)} or user ${actorId} performed ${logs.length} attendance-related edit actions in the review window. ` +
          `This is not necessarily improper, but it should be checked when preparing payroll.`,
        recommended_action:
          "Review the related changes and confirm they were expected, authorized, and supported by source documents or approvals.",
        confidence: 0.72,
        employee_id: targetKey ? String(logs[0][targetKey] || "") || null : null,
        attendance_id: null,
        leave_request_id: null,
        activity_log_id: idKey ? String(logs[0][idKey] || "") || null : null,
        source_refs: logs
          .slice(0, 20)
          .map((l) => `activity_log:${idKey ? String(l[idKey] || "") : "unknown"}`),
        source_data: {
          actor_id: actorId,
          log_count: logs.length,
          sampled_log_ids: idKey ? logs.slice(0, 20).map((l) => String(l[idKey] || "")) : [],
        },
      });
    }

    const afterHoursLogs = logs.filter((log) => {
      const raw = String(log[createdAtKey] || "");
      const dt = new Date(raw);
      if (Number.isNaN(dt.getTime())) return false;
      const hour = dt.getUTCHours();
      return hour < 6 || hour > 20;
    });

    if (afterHoursLogs.length >= 5) {
      findings.push({
        finding_ref: nextRef(),
        category: "after_hours_attendance_edits",
        severity: "low",
        title: `Multiple attendance-related edits occurred outside regular hours`,
        explanation:
          `${employeeName(actorId)} or user ${actorId} has ${afterHoursLogs.length} attendance-related edit actions outside regular hours in the review window.`,
        recommended_action:
          "Review whether these changes were operationally expected and whether they require additional supervisor validation.",
        confidence: 0.65,
        employee_id: targetKey ? String(afterHoursLogs[0][targetKey] || "") || null : null,
        attendance_id: null,
        leave_request_id: null,
        activity_log_id: idKey ? String(afterHoursLogs[0][idKey] || "") || null : null,
        source_refs: afterHoursLogs
          .slice(0, 20)
          .map((l) => `activity_log:${idKey ? String(l[idKey] || "") : "unknown"}`),
        source_data: {
          actor_id: actorId,
          after_hours_count: afterHoursLogs.length,
          sampled_log_ids: idKey
            ? afterHoursLogs.slice(0, 20).map((l) => String(l[idKey] || ""))
            : [],
        },
      });
    }
  }

  return findings;
}

function buildSummaryStats(input: {
  employees: EmployeeRow[];
  attendances: AttendanceRow[];
  leaveRequestDates: LeaveRequestDateRow[];
  rawActivityLogs: Record<string, unknown>[];
  ruleFindings: RuleFinding[];
}) {
  return {
    employee_count: input.employees.length,
    attendance_count: input.attendances.length,
    leave_date_count: input.leaveRequestDates.length,
    activity_log_count: input.rawActivityLogs.length,
    finding_count: input.ruleFindings.length,
    high_count: input.ruleFindings.filter((f) => f.severity === "high").length,
    medium_count: input.ruleFindings.filter((f) => f.severity === "medium").length,
    low_count: input.ruleFindings.filter((f) => f.severity === "low").length,
  };
}

function buildFallbackSummary(
  summaryStats: ReturnType<typeof buildSummaryStats>,
  findings: RuleFinding[],
) {
  if (findings.length === 0) {
    return {
      summary:
        "No attendance or payroll-impacting anomalies were detected in the selected review window based on the current deterministic checks.",
      payroll_risk: "low" as Severity,
    };
  }

  const high = summaryStats.high_count;
  const medium = summaryStats.medium_count;
  const low = summaryStats.low_count;

  let payroll_risk: Severity = "low";
  if (high >= 1) payroll_risk = "high";
  else if (medium >= 3 || medium >= 1) payroll_risk = "medium";

  const topCategories = [...new Set(findings.map((f) => f.category))].slice(0, 5);

  return {
    summary:
      `Detected ${findings.length} finding(s) across ${summaryStats.employee_count} employee(s) ` +
      `and ${summaryStats.attendance_count} attendance record(s). ` +
      `Severity breakdown: ${high} high, ${medium} medium, ${low} low. ` +
      `Top issue categories: ${topCategories.join(", ")}.`,
    payroll_risk,
  };
}

async function getAISummary(input: {
  review_type: ReviewType;
  date_from: string;
  date_to: string;
  employee_id: string | null;
  department_id: string | null;
  location_id: string | null;
  summaryStats: ReturnType<typeof buildSummaryStats>;
  ruleFindings: RuleFinding[];
}): Promise<{ parsed: AIResponse; raw: Record<string, unknown> }> {
  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      summary: { type: "string" },
      payroll_risk: {
        type: "string",
        enum: ["low", "medium", "high"],
      },
      findings: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            finding_ref: { type: "string" },
            severity: {
              type: "string",
              enum: ["low", "medium", "high"],
            },
            title: { type: "string" },
            explanation: { type: "string" },
            recommended_action: { type: "string" },
            confidence: { type: "number" },
          },
          required: [
            "finding_ref",
            "severity",
            "title",
            "explanation",
            "recommended_action",
            "confidence",
          ],
        },
      },
    },
    required: ["summary", "payroll_risk", "findings"],
  };

  const compactFindings = input.ruleFindings.map((f) => ({
    finding_ref: f.finding_ref,
    category: f.category,
    current_severity: f.severity,
    title: f.title,
    explanation: f.explanation,
    recommended_action: f.recommended_action,
    confidence: f.confidence,
    employee_id: f.employee_id,
    attendance_id: f.attendance_id,
    leave_request_id: f.leave_request_id,
    activity_log_id: f.activity_log_id,
    source_refs: f.source_refs,
    source_data: f.source_data,
  }));

  const promptPayload = {
    review_scope: {
      review_type: input.review_type,
      date_from: input.date_from,
      date_to: input.date_to,
      employee_id: input.employee_id,
      department_id: input.department_id,
      location_id: input.location_id,
    },
    summary_stats: input.summaryStats,
    findings: compactFindings,
  };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      store: false,
      instructions:
        "You are an HR payroll and attendance review assistant. " +
        "You do not make final disciplinary or payroll decisions. " +
        "Only summarize, prioritize, and explain findings already provided. " +
        "Do not invent new IDs, dates, or evidence. " +
        "Return only valid JSON matching the schema.",
      input: JSON.stringify(promptPayload),
      text: {
        format: {
          type: "json_schema",
          name: "attendance_payroll_review",
          schema,
        },
      },
    }),
  });

  const raw = await response.json();

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${JSON.stringify(raw)}`);
  }

  const outputText = extractResponseOutputText(raw);
  if (!outputText) {
    throw new Error("OpenAI response did not include output text");
  }

  const parsed = JSON.parse(outputText) as AIResponse;
  return { parsed, raw };
}

function extractResponseOutputText(raw: Record<string, unknown>): string {
  if (typeof raw.output_text === "string" && raw.output_text.trim()) {
    return raw.output_text;
  }

  const output = Array.isArray(raw.output) ? raw.output : [];
  const texts: string[] = [];

  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = Array.isArray((item as Record<string, unknown>).content)
      ? ((item as Record<string, unknown>).content as Array<Record<string, unknown>>)
      : [];

    for (const part of content) {
      if (typeof part?.text === "string") {
        texts.push(part.text);
      } else if (
        part?.type === "output_text" &&
        typeof part?.text === "string"
      ) {
        texts.push(part.text);
      }
    }
  }

  return texts.join("\n").trim();
}