import { supabase } from "../lib/supabase";

export type ShiftChangeRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled";

export type ShiftChangeRequest = {
  id: string;
  user_id: string;
  request_date: string;
  requested_shift_id: string;
  status: ShiftChangeRequestStatus;
  request_reason: string;
  admin_remarks: string | null;
  created_by: string;
  reviewed_by: string | null;
  created_at: string;
  reviewed_at: string | null;
  users?: {
    id: string;
    name: string | null;
    email: string | null;
    department: string | null;
    shift_id: string | null;
    shifts?: {
      id: string;
      name: string | null;
      start_time: string | null;
      end_time: string | null;
    } | null;
  } | null;
  requested_shift?: {
    id: string;
    name: string | null;
    start_time: string | null;
    end_time: string | null;
    location_id: string | null;
    grace_minutes: number | null;
    overtime_after_minutes: number | null;
  } | null;
};

function combineDateAndTime(date: string, time?: string | null) {
  if (!date || !time) return null;
  return `${date}T${time.slice(0, 8)}+08:00`;
}

function getMinutesDifference(later: Date, earlier: Date) {
  return Math.max(0, Math.floor((later.getTime() - earlier.getTime()) / 60000));
}

function getScheduleForDate(date: string, shift: any) {
  const scheduledStart = combineDateAndTime(date, shift.start_time);
  const scheduledEndRaw = combineDateAndTime(date, shift.end_time);

  if (!scheduledStart || !scheduledEndRaw) {
    return { scheduledStart: null, scheduledEnd: null };
  }

  const startDate = new Date(scheduledStart);
  let endDate = new Date(scheduledEndRaw);

  if (endDate <= startDate) {
    endDate = new Date(endDate.getTime() + 24 * 60 * 60 * 1000);
  }

  return {
    scheduledStart: startDate.toISOString(),
    scheduledEnd: endDate.toISOString(),
  };
}

function resolveStatus(params: {
  isHoliday: boolean;
  isRestDay: boolean;
  isLate: boolean;
  isOvertime: boolean;
  worked: boolean;
}) {
  if (!params.worked) {
    if (params.isHoliday && params.isRestDay) return "holiday_restday";
    if (params.isHoliday) return "holiday";
    if (params.isRestDay) return "restday";
    return "absent";
  }

  if (params.isHoliday && params.isRestDay) return "worked_holiday_restday";
  if (params.isHoliday) return "worked_holiday";
  if (params.isRestDay) return "worked_restday";
  if (params.isLate && params.isOvertime) return "late_overtime";
  if (params.isLate) return "late";
  if (params.isOvertime) return "overtime";
  return "present";
}

function getPHDayOfWeek(date: string) {
  const manilaDate = new Date(`${date}T12:00:00+08:00`);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    weekday: "long",
  }).format(manilaDate);
}

async function getDayContext(
  userId: string,
  date: string,
  locationId: string | null
) {
  let holidayQuery = supabase
    .from("holidays")
    .select("*")
    .eq("holiday_date", date);

  if (locationId) {
    holidayQuery = holidayQuery.or(`location_id.is.null,location_id.eq.${locationId}`);
  } else {
    holidayQuery = holidayQuery.is("location_id", null);
  }

  const [holidayRes, restDayRes] = await Promise.all([
    holidayQuery.order("created_at", { ascending: false }),
    supabase
      .from("user_rest_days")
      .select("id")
      .eq("user_id", userId)
      .eq("day_of_week", getPHDayOfWeek(date))
      .lte("effective_from", date)
      .or(`effective_to.is.null,effective_to.gte.${date}`),
  ]);

  if (holidayRes.error) throw holidayRes.error;
  if (restDayRes.error) throw restDayRes.error;

  const holiday = holidayRes.data?.[0] ?? null;

  return {
    isHoliday: !!holiday,
    holidayName: holiday?.name ?? null,
    isRestDay: (restDayRes.data?.length ?? 0) > 0,
  };
}

async function applyApprovedShiftToAttendance(request: ShiftChangeRequest) {
  const { data: shift, error: shiftError } = await supabase
    .from("shifts")
    .select("*")
    .eq("id", request.requested_shift_id)
    .single();

  if (shiftError) throw shiftError;

  const { data: attendance, error: attendanceFetchError } = await supabase
    .from("attendance")
    .select("*")
    .eq("user_id", request.user_id)
    .eq("date", request.request_date)
    .maybeSingle();

  if (attendanceFetchError) throw attendanceFetchError;
  if (!attendance) return;

  const { scheduledStart, scheduledEnd } = getScheduleForDate(
    request.request_date,
    shift
  );

  const clockIn = attendance.clock_in ? new Date(attendance.clock_in) : null;
  const clockOut = attendance.clock_out ? new Date(attendance.clock_out) : null;
  const shiftStart = scheduledStart ? new Date(scheduledStart) : null;
  const shiftEnd = scheduledEnd ? new Date(scheduledEnd) : null;
  const dayContext = await getDayContext(
    request.user_id,
    request.request_date,
    shift.location_id ?? null
  );

  let minutesLate = 0;
  let minutesOvertime = 0;

  if (clockIn && shiftStart) {
    const graceLimit = new Date(
      shiftStart.getTime() + Number(shift.grace_minutes ?? 0) * 60000
    );
    minutesLate = getMinutesDifference(clockIn, graceLimit);
  }

  if (clockOut && shiftEnd) {
    const overtimeThreshold = new Date(
      shiftEnd.getTime() + Number(shift.overtime_after_minutes ?? 0) * 60000
    );
    minutesOvertime =
      clockOut > overtimeThreshold ? getMinutesDifference(clockOut, shiftEnd) : 0;
  }

  const isLate = minutesLate > 0;
  const isOvertime = minutesOvertime > 0;
  const worked = !!clockIn;
  const status = resolveStatus({
    worked,
    isHoliday: dayContext.isHoliday,
    isRestDay: dayContext.isRestDay,
    isLate,
    isOvertime,
  });

  const remarks = attendance.remarks
    ? `${attendance.remarks}; Shift changed via approved request`
    : "Shift changed via approved request";

  const { error: updateError } = await supabase
    .from("attendance")
    .update({
      shift_id: shift.id,
      location_id: shift.location_id,
      scheduled_start: scheduledStart,
      scheduled_end: scheduledEnd,
      minutes_late: minutesLate,
      minutes_overtime: minutesOvertime,
      is_late: isLate,
      is_overtime: isOvertime,
      is_holiday: dayContext.isHoliday,
      is_restday: dayContext.isRestDay,
      holiday_name: dayContext.holidayName,
      status,
      remarks,
    })
    .eq("id", attendance.id);

  if (updateError) throw updateError;
}

export const shiftChangeRequestService = {
  async createRequest(payload: {
    user_id: string;
    request_date: string;
    requested_shift_id: string;
    request_reason: string;
  }) {
    const { data, error } = await supabase
      .from("shift_change_requests")
      .insert({
        user_id: payload.user_id,
        request_date: payload.request_date,
        requested_shift_id: payload.requested_shift_id,
        request_reason: payload.request_reason,
        created_by: payload.user_id,
        status: "pending",
      })
      .select()
      .single();

    if (error) throw error;
    return data as ShiftChangeRequest;
  },

  async getMyRequests(userId: string) {
    const { data, error } = await supabase
      .from("shift_change_requests")
      .select(
        `
        *,
        requested_shift:requested_shift_id (
          id,
          name,
          start_time,
          end_time,
          location_id,
          grace_minutes,
          overtime_after_minutes
        )
      `
      )
      .eq("user_id", userId)
      .order("request_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []) as ShiftChangeRequest[];
  },

  async getAllRequests() {
    const { data, error } = await supabase
      .from("shift_change_requests")
      .select(
        `
        *,
        users:user_id (
          id,
          name,
          email,
          department,
          shift_id,
          shifts:shift_id (
            id,
            name,
            start_time,
            end_time
          )
        ),
        requested_shift:requested_shift_id (
          id,
          name,
          start_time,
          end_time,
          location_id,
          grace_minutes,
          overtime_after_minutes
        )
      `
      )
      .order("request_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []) as ShiftChangeRequest[];
  },

  async approveRequest(
    request: ShiftChangeRequest,
    payload: { reviewed_by: string; admin_remarks?: string }
  ) {
    await applyApprovedShiftToAttendance(request);

    const { data, error } = await supabase
      .from("shift_change_requests")
      .update({
        status: "approved",
        reviewed_by: payload.reviewed_by,
        admin_remarks: payload.admin_remarks || null,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", request.id)
      .select()
      .single();

    if (error) throw error;
    return data as ShiftChangeRequest;
  },

  async rejectRequest(
    requestId: string,
    payload: { reviewed_by: string; admin_remarks: string }
  ) {
    const { data, error } = await supabase
      .from("shift_change_requests")
      .update({
        status: "rejected",
        reviewed_by: payload.reviewed_by,
        admin_remarks: payload.admin_remarks,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId)
      .select()
      .single();

    if (error) throw error;
    return data as ShiftChangeRequest;
  },
};
