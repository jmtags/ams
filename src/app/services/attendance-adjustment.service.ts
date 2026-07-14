import { supabase } from "../lib/supabase";

function combineDateAndTime(date: string, time: string) {
  if (!date || !time) return null;
  return `${date}T${time}:00+08:00`;
}

function getMinutesDifference(later: Date, earlier: Date) {
  return Math.max(
    0,
    Math.floor((later.getTime() - earlier.getTime()) / 1000 / 60)
  );
}

export const attendanceAdjustmentService = {
  // GET ALL REQUESTS
  getAllRequests: async () => {
    const { data, error } = await supabase
      .from("attendance_adjustments")
      .select(`
        *,
        users:user_id (
          id,
          name,
          email,
          department,
          shift_id
        ),
        attendance:attendance_id (
          id,
          user_id,
          date,
          clock_in,
          clock_out,
          status,
          shift_id,
          location_id,
          scheduled_start,
          scheduled_end,
          minutes_late,
          minutes_overtime,
          is_late,
          is_overtime,
          remarks
        ),
        reviewed_by_user:reviewed_by (
          id,
          name,
          email
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching attendance adjustment requests:", error);
      throw error;
    }

    return data ?? [];
  },

  // GET ONLY PENDING
  getPendingRequests: async () => {
    const { data, error } = await supabase
      .from("attendance_adjustments")
      .select(`
        *,
        users:user_id (
          id,
          name,
          email,
          department,
          shift_id
        ),
        attendance:attendance_id (
          id,
          user_id,
          date,
          clock_in,
          clock_out,
          status,
          shift_id,
          location_id,
          scheduled_start,
          scheduled_end,
          minutes_late,
          minutes_overtime,
          is_late,
          is_overtime,
          remarks
        )
      `)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching pending attendance adjustment requests:", error);
      throw error;
    }

    return data ?? [];
  },

  // GET ALL SHIFTS
  getAllShifts: async () => {
    const { data, error } = await supabase
      .from("shifts")
      .select(`
        *,
        locations:location_id (
          id,
          name
        )
      `)
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching shifts:", error);
      throw error;
    }

    return data ?? [];
  },

  // REJECT REQUEST
  rejectRequest: async (
    requestId: string,
    adminRemarks: string,
    reviewedBy: string
  ) => {
    const { data, error } = await supabase
      .from("attendance_adjustments")
      .update({
        status: "rejected",
        admin_remarks: adminRemarks || null,
        reviewed_by: reviewedBy,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", requestId)
      .select()
      .single();

    if (error) {
      console.error("Error rejecting attendance adjustment request:", error);
      throw error;
    }

    return data;
  },

  // APPROVE REQUEST + UPDATE ATTENDANCE
  approveRequest: async (
    request: any,
    payload: {
      approved_clock_in: string | null;
      approved_clock_out: string | null;
      admin_remarks: string;
      reviewed_by: string;
    }
  ) => {
    const attendance = request.attendance;
    if (!attendance) {
      throw new Error("Attendance record not found for this request.");
    }

    const shiftId = attendance.shift_id;
    let shift: any = null;

    if (shiftId) {
      const { data: shiftData, error: shiftError } = await supabase
        .from("shifts")
        .select(`
          *,
          locations:location_id (
            id,
            name
          )
        `)
        .eq("id", shiftId)
        .single();

      if (shiftError) {
        console.error("Error fetching shift for attendance adjustment:", shiftError);
        throw shiftError;
      }

      shift = shiftData;
    }

    const attendanceDate = attendance.date;

    let scheduledStart: string | null = null;
    let scheduledEnd: string | null = null;
    let minutesLate = 0;
    let minutesOvertime = 0;
    let isLate = false;
    let isOvertime = false;
    let status = "present";

    if (shift) {
      scheduledStart = combineDateAndTime(
        attendanceDate,
        shift.start_time?.slice(0, 5)
      );
      scheduledEnd = combineDateAndTime(
        attendanceDate,
        shift.end_time?.slice(0, 5)
      );

      if (payload.approved_clock_in && scheduledStart) {
        const actualClockIn = new Date(payload.approved_clock_in);
        const shiftStart = new Date(scheduledStart);
        shiftStart.setMinutes(
          shiftStart.getMinutes() + (shift.grace_minutes ?? 0)
        );

        minutesLate = getMinutesDifference(actualClockIn, shiftStart);
        isLate = minutesLate > 0;
      }

      if (payload.approved_clock_out && scheduledEnd) {
        const actualClockOut = new Date(payload.approved_clock_out);
        const shiftEnd = new Date(scheduledEnd);
        const overtimeThreshold = new Date(
          shiftEnd.getTime() + (shift.overtime_after_minutes ?? 0) * 60000
        );

        isOvertime = actualClockOut > overtimeThreshold;
        minutesOvertime = isOvertime
          ? getMinutesDifference(actualClockOut, shiftEnd)
          : 0;
      }
    }

    if (isLate && isOvertime) {
      status = "late_overtime";
    } else if (isLate) {
      status = "late";
    } else if (isOvertime) {
      status = "overtime";
    } else {
      status = "present";
    }

    const updatedRemarks = payload.admin_remarks?.trim()
      ? `Adjusted via approved request: ${payload.admin_remarks.trim()}`
      : attendance.remarks;

    const { error: attendanceError } = await supabase
      .from("attendance")
      .update({
        clock_in: payload.approved_clock_in,
        clock_out: payload.approved_clock_out,
        scheduled_start: scheduledStart,
        scheduled_end: scheduledEnd,
        minutes_late: minutesLate,
        minutes_overtime: minutesOvertime,
        is_late: isLate,
        is_overtime: isOvertime,
        status,
        remarks: updatedRemarks,
      })
      .eq("id", attendance.id);

    if (attendanceError) {
      console.error("Error updating attendance during approval:", attendanceError);
      throw attendanceError;
    }

    const { data, error } = await supabase
      .from("attendance_adjustments")
      .update({
        status: "approved",
        approved_clock_in: payload.approved_clock_in,
        approved_clock_out: payload.approved_clock_out,
        admin_remarks: payload.admin_remarks || null,
        reviewed_by: payload.reviewed_by,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", request.id)
      .select()
      .single();

    if (error) {
      console.error("Error approving attendance adjustment request:", error);
      throw error;
    }

    return data;
  },
};
