import { supabase } from "../lib/supabase";

const mapAttendance = (record: any) => ({
  id: record.id,
  userId: record.user_id,
  clockIn: record.clock_in,
  clockOut: record.clock_out,
  date: record.date,
  status: record.status,
  locationId: record.location_id,
  createdAt: record.created_at,
});

export const attendanceService = {
  async clockIn(userId: string, locationId: string) {
    const today = new Date().toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("attendance")
      .insert({
        user_id: userId,
        clock_in: new Date().toISOString(),
        date: today,
        location_id: locationId,
        status: "present",
      })
      .select()
      .single();

    if (error) throw error;

    return mapAttendance(data);
  },

  async clockOut(recordId: string) {
    const { data, error } = await supabase
      .from("attendance")
      .update({
        clock_out: new Date().toISOString(),
      })
      .eq("id", recordId)
      .select()
      .single();

    if (error) throw error;

    return mapAttendance(data);
  },

  async getAttendanceHistory(userId: string, limit = 10) {
    const { data, error } = await supabase
      .from("attendance")
      .select("*")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(limit);

    if (error) throw error;

    return (data || []).map(mapAttendance);
  },

  async getTodayAttendance(userId: string) {
    const today = new Date().toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("attendance")
      .select("*")
      .eq("user_id", userId)
      .eq("date", today)
      .maybeSingle();

    if (error) throw error;

    return data ? mapAttendance(data) : null;
  },

  async getAllAttendance() {
    const { data, error } = await supabase
      .from("attendance")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return (data || []).map(mapAttendance);
  },
};
