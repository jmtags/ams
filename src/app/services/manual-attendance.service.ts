import { supabase } from "../lib/supabase";

export const manualAttendanceService = {
  // GET ALL MANUAL ATTENDANCE
  getAllManualAttendance: async () => {
    const { data, error } = await supabase
      .from("attendance")
      .select(`
        *,
        users:user_id (
          id,
          name,
          email,
          department,
          shift_id
        ),
        shifts:shift_id (
          id,
          name,
          start_time,
          end_time,
          grace_minutes,
          overtime_after_minutes,
          location_id,
          locations:location_id (
            id,
            name
          )
        ),
        locations:location_id (
          id,
          name
        )
      `)
      .or("remarks.ilike.%manual%,remarks.ilike.%Manual%")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching manual attendance:", error);
      throw error;
    }

    return data ?? [];
  },

  // GET ALL USERS FOR DROPDOWN
  getAllUsers: async () => {
    const { data, error } = await supabase
      .from("users")
      .select(`
        id,
        name,
        email,
        department,
        shift_id,
        shifts:shift_id (
          id,
          name,
          start_time,
          end_time,
          grace_minutes,
          overtime_after_minutes,
          location_id,
          locations:location_id (
            id,
            name
          )
        )
      `)
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching users:", error);
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

  // CHECK IF RECORD EXISTS FOR USER + DATE
  getAttendanceByUserAndDate: async (userId: string, date: string) => {
    const { data, error } = await supabase
      .from("attendance")
      .select(`
        *,
        users:user_id (
          id,
          name,
          email
        ),
        shifts:shift_id (
          id,
          name,
          start_time,
          end_time,
          grace_minutes,
          overtime_after_minutes,
          location_id,
          locations:location_id (
            id,
            name
          )
        )
      `)
      .eq("user_id", userId)
      .eq("date", date)
      .maybeSingle();

    if (error) {
      console.error("Error checking attendance record:", error);
      throw error;
    }

    return data;
  },

  // CREATE
  createManualAttendance: async (payload: any) => {
    const { data, error } = await supabase
      .from("attendance")
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error("Error creating manual attendance:", error);
      throw error;
    }

    return data;
  },

  // UPDATE
  updateManualAttendance: async (id: string, payload: any) => {
    const { data, error } = await supabase
      .from("attendance")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating manual attendance:", error);
      throw error;
    }

    return data;
  },

  // DELETE
  deleteManualAttendance: async (id: string) => {
    const { error } = await supabase
      .from("attendance")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting manual attendance:", error);
      throw error;
    }

    return true;
  },
};