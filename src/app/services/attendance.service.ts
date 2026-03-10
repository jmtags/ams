import { supabase } from "../lib/supabase";

const mapAttendance = (record: any) => ({
  id: record.id,
  userId: record.user_id,
  clockIn: record.clock_in,
  clockOut: record.clock_out,
  date: record.date,
  status: record.status,
  locationId: record.location_id,
  shiftId: record.shift_id,
  scheduledStart: record.scheduled_start,
  scheduledEnd: record.scheduled_end,
  minutesLate: record.minutes_late,
  minutesOvertime: record.minutes_overtime,
  isLate: record.is_late,
  isOvertime: record.is_overtime,
  isAbsent: record.is_absent,
  remarks: record.remarks,
  createdAt: record.created_at,
});

const getPHDate = () => {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
};

const getPHNow = () => {
  return new Date();
};

// Converts YYYY-MM-DD + HH:mm:ss to ISO-like Date object in Asia/Manila context
// Since JS Date uses local/browser timezone, safest is to keep all DB columns as timestamptz
// and construct timestamps carefully.
const buildPHDateTimeISOString = (date: string, time: string) => {
  // Example output: 2026-03-08T08:00:00+08:00
  return `${date}T${time}+08:00`;
};

const diffMinutes = (later: Date, earlier: Date) => {
  return Math.max(0, Math.floor((later.getTime() - earlier.getTime()) / 60000));
};

async function getUserShift(userId: string) {
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id, shift_id")
    .eq("id", userId)
    .single();

  if (userError) throw userError;
  if (!user?.shift_id) {
    throw new Error("User has no assigned shift.");
  }

  const { data: shift, error: shiftError } = await supabase
    .from("shifts")
    .select("*")
    .eq("id", user.shift_id)
    .eq("is_active", true)
    .single();

  if (shiftError) throw shiftError;

  return shift;
}

export const attendanceService = {
  async clockIn(userId: string, locationId: string) {
    const today = getPHDate();
    const now = getPHNow();

    // Prevent duplicate clock-in for the day
    const { data: existing, error: existingError } = await supabase
      .from("attendance")
      .select("*")
      .eq("user_id", userId)
      .eq("date", today)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existing) {
      throw new Error("You already have an attendance record for today.");
    }

    const shift = await getUserShift(userId);

    const scheduledStartISO = buildPHDateTimeISOString(today, shift.start_time);
    const scheduledEndISO = buildPHDateTimeISOString(today, shift.end_time);

    const scheduledStart = new Date(scheduledStartISO);
    let scheduledEnd = new Date(scheduledEndISO);

    // Handle overnight shifts like 22:00 to 06:00
    if (scheduledEnd <= scheduledStart) {
      scheduledEnd = new Date(scheduledEnd.getTime() + 24 * 60 * 60 * 1000);
    }

    const graceLimit = new Date(
      scheduledStart.getTime() + (shift.grace_minutes || 0) * 60000
    );

    const isLate = now > graceLimit;
    const minutesLate = isLate ? diffMinutes(now, scheduledStart) : 0;

    const { data, error } = await supabase
      .from("attendance")
      .insert({
        user_id: userId,
        date: today,
        location_id: locationId,
        shift_id: shift.id,
        status: "present",
        clock_in: now.toISOString(),
        scheduled_start: scheduledStart.toISOString(),
        scheduled_end: scheduledEnd.toISOString(),
        is_late: isLate,
        minutes_late: minutesLate,
        is_absent: false,
      })
      .select()
      .single();

    if (error) throw error;

    return mapAttendance(data);
  },

  async clockOut(recordId: string) {
    const now = getPHNow();

    const { data: record, error: recordError } = await supabase
      .from("attendance")
      .select("id, scheduled_end, shift_id, clock_out")
      .eq("id", recordId)
      .single();

    if (recordError) throw recordError;
    if (record.clock_out) {
      throw new Error("You have already clocked out.");
    }

    const { data: shift, error: shiftError } = await supabase
      .from("shifts")
      .select("overtime_after_minutes")
      .eq("id", record.shift_id)
      .single();

    if (shiftError) throw shiftError;

    const scheduledEnd = new Date(record.scheduled_end);
    const overtimeThreshold = new Date(
      scheduledEnd.getTime() + (shift.overtime_after_minutes || 0) * 60000
    );

    const isOvertime = now > overtimeThreshold;
    const minutesOvertime = isOvertime ? diffMinutes(now, scheduledEnd) : 0;

    const { data, error } = await supabase
      .from("attendance")
      .update({
        clock_out: now.toISOString(),
        is_overtime: isOvertime,
        minutes_overtime: minutesOvertime,
      })
      .eq("id", recordId)
      .select()
      .single();

    if (error) throw error;

    return mapAttendance(data);
  },

  async markAbsencesForDay(date: string) {
    // This function is intended for admin/cron usage
    // It inserts absent records for users with shifts but no attendance for the date.

    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, shift_id")
      .not("shift_id", "is", null);

    if (usersError) throw usersError;

    for (const user of users || []) {
      const { data: existing, error: existingError } = await supabase
        .from("attendance")
        .select("id")
        .eq("user_id", user.id)
        .eq("date", date)
        .maybeSingle();

      if (existingError) throw existingError;
      if (existing) continue;

      const { data: shift, error: shiftError } = await supabase
        .from("shifts")
        .select("*")
        .eq("id", user.shift_id)
        .single();

      if (shiftError) throw shiftError;

      const scheduledStartISO = buildPHDateTimeISOString(date, shift.start_time);
      const scheduledEndISO = buildPHDateTimeISOString(date, shift.end_time);

      let scheduledStart = new Date(scheduledStartISO);
      let scheduledEnd = new Date(scheduledEndISO);

      if (scheduledEnd <= scheduledStart) {
        scheduledEnd = new Date(scheduledEnd.getTime() + 24 * 60 * 60 * 1000);
      }

      const { error: insertError } = await supabase.from("attendance").insert({
        user_id: user.id,
        date,
        shift_id: shift.id,
        location_id: shift.location_id,
        status: "absent",
        scheduled_start: scheduledStart.toISOString(),
        scheduled_end: scheduledEnd.toISOString(),
        is_absent: true,
        is_late: false,
        is_overtime: false,
        minutes_late: 0,
        minutes_overtime: 0,
        remarks: "Auto-marked absent",
      });

      if (insertError) throw insertError;
    }

    return true;
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
    const today = getPHDate();

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