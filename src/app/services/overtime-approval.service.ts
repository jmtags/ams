import { supabase } from "../lib/supabase";

export type OvertimeApprovalRow = {
  id: string;
  user_id: string;
  date: string;
  clock_in: string | null;
  clock_out: string | null;
  scheduled_end: string | null;
  minutes_overtime: number;
  approved_overtime_minutes: number;
  overtime_status: "pending" | "approved" | "rejected";
  remarks: string | null;
  users?: {
    id: string;
    name: string | null;
    email: string | null;
    department: string | null;
  };
  shifts?: {
    id: string;
    name: string | null;
    overtime_after_minutes: number | null;
  };
};

export const overtimeApprovalService = {
  async getOvertimeRows(): Promise<OvertimeApprovalRow[]> {
    const { data, error } = await supabase
      .from("attendance")
      .select(`
        id,
        user_id,
        date,
        clock_in,
        clock_out,
        scheduled_end,
        minutes_overtime,
        approved_overtime_minutes,
        overtime_status,
        remarks,
        users:user_id (
          id,
          name,
          email,
          department
        ),
        shifts:shift_id (
          id,
          name,
          overtime_after_minutes
        )
      `)
      .or("is_overtime.eq.true,minutes_overtime.gt.0,approved_overtime_minutes.gt.0")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) throw error;

    return (data ?? []).map((row: any) => ({
      ...row,
      minutes_overtime: Number(row.minutes_overtime ?? 0),
      approved_overtime_minutes: Number(row.approved_overtime_minutes ?? 0),
      overtime_status: row.overtime_status ?? "pending",
    }));
  },

  async approveOvertime(
    attendanceId: string,
    approvedMinutes: number,
    remarks?: string
  ) {
    const { error } = await supabase
      .from("attendance")
      .update({
        approved_overtime_minutes: Math.max(0, Math.round(approvedMinutes)),
        overtime_status: "approved",
        remarks: remarks?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", attendanceId);

    if (error) throw error;
  },

  async rejectOvertime(attendanceId: string, remarks?: string) {
    const { error } = await supabase
      .from("attendance")
      .update({
        approved_overtime_minutes: 0,
        overtime_status: "rejected",
        remarks: remarks?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", attendanceId);

    if (error) throw error;
  },
};
