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
  isHoliday: record.is_holiday,
  isRestDay: record.is_restday,
  holidayName: record.holiday_name,
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

const getPHDayOfWeek = (date: string) => {
  const manilaDate = new Date(`${date}T12:00:00+08:00`);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    weekday: "long",
  }).format(manilaDate);
};

const getPHNow = () => new Date();

const buildPHDateTimeISOString = (date: string, time: string) => {
  return `${date}T${time}+08:00`;
};

const diffMinutes = (later: Date, earlier: Date) => {
  return Math.max(0, Math.floor((later.getTime() - earlier.getTime()) / 60000));
};

const buildRemarks = ({
  isHoliday,
  isRestDay,
  worked,
  holidayName,
  isLate = false,
  isOvertime = false,
}: {
  isHoliday: boolean;
  isRestDay: boolean;
  worked: boolean;
  holidayName?: string | null;
  isLate?: boolean;
  isOvertime?: boolean;
}) => {
  const parts: string[] = [];

  if (isHoliday) {
    parts.push(
      worked
        ? holidayName
          ? `Worked on Holiday (${holidayName})`
          : "Worked on Holiday"
        : holidayName
        ? `Holiday (${holidayName})`
        : "Holiday"
    );
  }

  if (isRestDay) {
    parts.push(worked ? "Worked on Rest Day" : "Rest Day");
  }

  if (isLate && !isHoliday && !isRestDay) {
    parts.push("Late");
  }

  if (isOvertime) {
    parts.push("Overtime");
  }

  return parts.join(", ");
};

const resolveAttendanceStatus = ({
  worked,
  isHoliday,
  isRestDay,
  isLate = false,
  isOvertime = false,
}: {
  worked: boolean;
  isHoliday: boolean;
  isRestDay: boolean;
  isLate?: boolean;
  isOvertime?: boolean;
}) => {
  if (!worked) {
    if (isHoliday && isRestDay) return "holiday_restday";
    if (isHoliday) return "holiday";
    if (isRestDay) return "restday";
    return "absent";
  }

  if (isHoliday && isRestDay) return "worked_holiday_restday";
  if (isHoliday) return "worked_holiday";
  if (isRestDay) return "worked_restday";
  if (isLate && isOvertime) return "late_overtime";
  if (isLate) return "late";
  if (isOvertime) return "overtime";

  return "present";
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

async function getHolidayForDate(date: string, locationId: string | null) {
  let query = supabase
    .from("holidays")
    .select("*")
    .eq("holiday_date", date);

  if (locationId) {
    query = query.or(`location_id.is.null,location_id.eq.${locationId}`);
  } else {
    query = query.is("location_id", null);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) throw error;

  return data?.[0] ?? null;
}

async function isUserRestDayForDate(userId: string, date: string) {
  const dayOfWeek = getPHDayOfWeek(date);

  const { data, error } = await supabase
    .from("user_rest_days")
    .select("id")
    .eq("user_id", userId)
    .eq("day_of_week", dayOfWeek)
    .lte("effective_from", date)
    .or(`effective_to.is.null,effective_to.gte.${date}`);

  if (error) throw error;

  return (data?.length ?? 0) > 0;
}

async function getDayContext(
  userId: string,
  date: string,
  locationId: string | null
) {
  const [holiday, isRestDay] = await Promise.all([
    getHolidayForDate(date, locationId),
    isUserRestDayForDate(userId, date),
  ]);

  return {
    isHoliday: !!holiday,
    holidayName: holiday?.name ?? null,
    holidayType: holiday?.type ?? null,
    isRestDay,
  };
}

function getShiftSchedule(date: string, shift: any) {
  const scheduledStartISO = buildPHDateTimeISOString(date, shift.start_time);
  const scheduledEndISO = buildPHDateTimeISOString(date, shift.end_time);

  const scheduledStart = new Date(scheduledStartISO);
  let scheduledEnd = new Date(scheduledEndISO);

  if (scheduledEnd <= scheduledStart) {
    scheduledEnd = new Date(scheduledEnd.getTime() + 24 * 60 * 60 * 1000);
  }

  return {
    scheduledStart,
    scheduledEnd,
  };
}

export const attendanceService = {
  async clockIn(userId: string, locationId: string) {
    const today = getPHDate();
    const now = getPHNow();

    const { data: existing, error: existingError } = await supabase
      .from("attendance")
      .select("*")
      .eq("user_id", userId)
      .eq("date", today)
      .maybeSingle();

    if (existingError) throw existingError;

    const shift = await getUserShift(userId);
    const { scheduledStart, scheduledEnd } = getShiftSchedule(today, shift);
    const dayContext = await getDayContext(userId, today, shift.location_id);

    const graceLimit = new Date(
      scheduledStart.getTime() + (shift.grace_minutes || 0) * 60000
    );

    const shouldCheckLate = !dayContext.isHoliday && !dayContext.isRestDay;
    const isLate = shouldCheckLate ? now > graceLimit : false;
    const minutesLate = isLate ? diffMinutes(now, scheduledStart) : 0;

    const status = resolveAttendanceStatus({
      worked: true,
      isHoliday: dayContext.isHoliday,
      isRestDay: dayContext.isRestDay,
      isLate,
      isOvertime: false,
    });

    const remarks = buildRemarks({
      isHoliday: dayContext.isHoliday,
      isRestDay: dayContext.isRestDay,
      worked: true,
      holidayName: dayContext.holidayName,
      isLate,
      isOvertime: false,
    });

    if (existing) {
      if (existing.clock_in) {
        throw new Error("You already have an attendance record for today.");
      }

      const { data, error } = await supabase
        .from("attendance")
        .update({
          clock_in: now.toISOString(),
          location_id: locationId,
          shift_id: shift.id,
          status,
          scheduled_start: scheduledStart.toISOString(),
          scheduled_end: scheduledEnd.toISOString(),
          is_late: isLate,
          minutes_late: minutesLate,
          is_absent: false,
          is_overtime: false,
          minutes_overtime: 0,
          is_holiday: dayContext.isHoliday,
          is_restday: dayContext.isRestDay,
          holiday_name: dayContext.holidayName,
          remarks: remarks || existing.remarks || null,
        })
        .eq("id", existing.id)
        .select()
        .single();

      if (error) throw error;

      return mapAttendance(data);
    }

    const { data, error } = await supabase
      .from("attendance")
      .insert({
        user_id: userId,
        date: today,
        location_id: locationId,
        shift_id: shift.id,
        status,
        clock_in: now.toISOString(),
        scheduled_start: scheduledStart.toISOString(),
        scheduled_end: scheduledEnd.toISOString(),
        is_late: isLate,
        minutes_late: minutesLate,
        is_absent: false,
        is_overtime: false,
        minutes_overtime: 0,
        is_holiday: dayContext.isHoliday,
        is_restday: dayContext.isRestDay,
        holiday_name: dayContext.holidayName,
        remarks: remarks || null,
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
      .select(
        `
        id,
        scheduled_end,
        shift_id,
        clock_in,
        clock_out,
        is_holiday,
        is_restday,
        holiday_name,
        is_late,
        minutes_late
      `
      )
      .eq("id", recordId)
      .single();

    if (recordError) throw recordError;

    if (record.clock_out) {
      throw new Error("You have already clocked out.");
    }

    if (!record.clock_in) {
      throw new Error("Cannot clock out without a clock in record.");
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

    const status = resolveAttendanceStatus({
      worked: true,
      isHoliday: !!record.is_holiday,
      isRestDay: !!record.is_restday,
      isLate: !!record.is_late,
      isOvertime,
    });

    const remarks = buildRemarks({
      isHoliday: !!record.is_holiday,
      isRestDay: !!record.is_restday,
      worked: true,
      holidayName: record.holiday_name,
      isLate: !!record.is_late,
      isOvertime,
    });

    const { data, error } = await supabase
      .from("attendance")
      .update({
        clock_out: now.toISOString(),
        status,
        is_overtime: isOvertime,
        minutes_overtime: minutesOvertime,
        remarks: remarks || null,
      })
      .eq("id", recordId)
      .select()
      .single();

    if (error) throw error;

    return mapAttendance(data);
  },

  async markAbsencesForDay(date: string) {
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
        .eq("is_active", true)
        .single();

      if (shiftError) throw shiftError;

      const { scheduledStart, scheduledEnd } = getShiftSchedule(date, shift);
      const dayContext = await getDayContext(user.id, date, shift.location_id);

      const status = resolveAttendanceStatus({
        worked: false,
        isHoliday: dayContext.isHoliday,
        isRestDay: dayContext.isRestDay,
      });

      const isAbsent = !dayContext.isHoliday && !dayContext.isRestDay;

      const remarks = isAbsent
        ? "Auto-marked absent"
        : buildRemarks({
            isHoliday: dayContext.isHoliday,
            isRestDay: dayContext.isRestDay,
            worked: false,
            holidayName: dayContext.holidayName,
          });

      const { error: insertError } = await supabase.from("attendance").insert({
        user_id: user.id,
        date,
        shift_id: shift.id,
        location_id: shift.location_id,
        status,
        scheduled_start: scheduledStart.toISOString(),
        scheduled_end: scheduledEnd.toISOString(),
        is_absent: isAbsent,
        is_late: false,
        is_overtime: false,
        minutes_late: 0,
        minutes_overtime: 0,
        is_holiday: dayContext.isHoliday,
        is_restday: dayContext.isRestDay,
        holiday_name: dayContext.holidayName,
        remarks,
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