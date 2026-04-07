import { supabase } from "../lib/supabase";

export type ActivityLogManagementRow = {
  attendance_id: string;
  date: string;
  user_id: string;
  user_name: string;
  user_email: string | null;
  department: string | null;
  shift_name: string | null;
  clock_in: string | null;
  clock_out: string | null;
  status: string | null;
  activities: {
    id: string;
    activity_text: string;
    hours_spent: number | null;
    output_note: string | null;
    created_at: string;
  }[];
};

export const attendanceActivityLogManagementService = {
  async getActivityLogs(filters?: {
    userId?: string;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
  }): Promise<ActivityLogManagementRow[]> {
    let attendanceQuery = supabase
      .from("attendance")
      .select(`
        id,
        user_id,
        date,
        clock_in,
        clock_out,
        status,
        shift_id,
        users:user_id (
          id,
          name,
          email,
          department
        ),
        shifts:shift_id (
          id,
          name
        )
      `)
      .order("date", { ascending: false });

    if (filters?.userId) {
      attendanceQuery = attendanceQuery.eq("user_id", filters.userId);
    }

    if (filters?.dateFrom) {
      attendanceQuery = attendanceQuery.gte("date", filters.dateFrom);
    }

    if (filters?.dateTo) {
      attendanceQuery = attendanceQuery.lte("date", filters.dateTo);
    }

    const { data: attendanceRows, error: attendanceError } = await attendanceQuery;

    if (attendanceError) throw attendanceError;

    const attendanceIds = (attendanceRows ?? []).map((row: any) => row.id);

    if (attendanceIds.length === 0) {
      return [];
    }

    const { data: activityRows, error: activityError } = await supabase
      .from("attendance_activity_logs")
      .select(`
        id,
        attendance_id,
        activity_text,
        hours_spent,
        output_note,
        created_at
      `)
      .in("attendance_id", attendanceIds)
      .order("created_at", { ascending: true });

    if (activityError) throw activityError;

    const groupedActivities = new Map<string, any[]>();

    for (const row of activityRows ?? []) {
      const current = groupedActivities.get(row.attendance_id) ?? [];
      current.push(row);
      groupedActivities.set(row.attendance_id, current);
    }

    let result: ActivityLogManagementRow[] = (attendanceRows ?? [])
      .map((row: any) => ({
        attendance_id: row.id,
        date: row.date,
        user_id: row.user_id,
        user_name: row.users?.name ?? "-",
        user_email: row.users?.email ?? null,
        department: row.users?.department ?? null,
        shift_name: row.shifts?.name ?? null,
        clock_in: row.clock_in,
        clock_out: row.clock_out,
        status: row.status ?? null,
        activities: groupedActivities.get(row.id) ?? [],
      }))
      .filter((row) => row.activities.length > 0);

    if (filters?.search?.trim()) {
      const q = filters.search.trim().toLowerCase();

      result = result.filter((row) => {
        const haystack = [
          row.user_name,
          row.user_email ?? "",
          row.department ?? "",
          row.shift_name ?? "",
          row.status ?? "",
          ...row.activities.map((a) => a.activity_text),
          ...row.activities.map((a) => a.output_note ?? ""),
        ]
          .join(" ")
          .toLowerCase();

        return haystack.includes(q);
      });
    }

    return result;
  },

  async getUsersForFilter() {
    const { data, error } = await supabase
      .from("users")
      .select("id, name, email")
      .order("name", { ascending: true });

    if (error) throw error;
    return data ?? [];
  },
};