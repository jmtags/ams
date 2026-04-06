import { supabase } from "../lib/supabase";

export const attendanceAdjustmentRequestService = {
  createRequest: async (payload: {
    attendance_id: string;
    user_id: string;
    previous_clock_in: string | null;
    previous_clock_out: string | null;
    requested_clock_in: string | null;
    requested_clock_out: string | null;
    request_reason: string;
    created_by: string;
  }) => {
    const { data, error } = await supabase
      .from("attendance_adjustments")
      .insert({
        attendance_id: payload.attendance_id,
        user_id: payload.user_id,
        request_type: "punch_alteration",
        status: "pending",
        previous_clock_in: payload.previous_clock_in,
        previous_clock_out: payload.previous_clock_out,
        requested_clock_in: payload.requested_clock_in,
        requested_clock_out: payload.requested_clock_out,
        request_reason: payload.request_reason,
        created_by: payload.created_by,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating attendance adjustment request:", error);
      throw error;
    }

    return data;
  },

  getPendingRequestByAttendanceId: async (attendanceId: string) => {
    const { data, error } = await supabase
      .from("attendance_adjustments")
      .select("*")
      .eq("attendance_id", attendanceId)
      .eq("status", "pending")
      .maybeSingle();

    if (error) {
      console.error("Error checking pending attendance adjustment request:", error);
      throw error;
    }

    return data;
  },
};