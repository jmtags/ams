import { supabase } from "../lib/supabase";

export type AttendanceActivityLog = {
  id: string;
  attendance_id: string;
  user_id: string;
  activity_text: string;
  hours_spent: number | null;
  output_note: string | null;
  created_at: string;
  updated_at?: string | null;
};

export type AttendanceActivityLogInput = {
  activity_text: string;
  hours_spent?: number | null;
  output_note?: string | null;
};

export const attendanceActivityLogService = {
  async getByAttendanceId(attendanceId: string): Promise<AttendanceActivityLog[]> {
    const { data, error } = await supabase
      .from("attendance_activity_logs")
      .select("*")
      .eq("attendance_id", attendanceId)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async replaceLogs(
    attendanceId: string,
    userId: string,
    logs: AttendanceActivityLogInput[]
  ) {
    const cleanedLogs = logs
      .map((log) => ({
        activity_text: log.activity_text.trim(),
        hours_spent:
          log.hours_spent === undefined || log.hours_spent === null || Number.isNaN(Number(log.hours_spent))
            ? null
            : Number(log.hours_spent),
        output_note: log.output_note?.trim() ? log.output_note.trim() : null,
      }))
      .filter((log) => log.activity_text);

    const { error: deleteError } = await supabase
      .from("attendance_activity_logs")
      .delete()
      .eq("attendance_id", attendanceId);

    if (deleteError) throw deleteError;

    if (cleanedLogs.length === 0) {
      return [];
    }

    const payload = cleanedLogs.map((log) => ({
      attendance_id: attendanceId,
      user_id: userId,
      activity_text: log.activity_text,
      hours_spent: log.hours_spent,
      output_note: log.output_note,
    }));

    const { data, error } = await supabase
      .from("attendance_activity_logs")
      .insert(payload)
      .select("*");

    if (error) throw error;

    return data || [];
  },
};