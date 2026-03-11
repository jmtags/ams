import { supabase } from "../lib/supabase"
import type { AttendanceRecord } from "../lib/types"

export type AttendanceSummaryRow = {
  userId: string
  name: string
  email: string
  department: string
  locationId: string | null
  presentDays: number
  absentDays: number
  workedHolidayDays: number
  workedHolidayRestDayDays: number
  workedRestDayDays: number
  restDays: number
  totalCountedDays: number
}

type DashboardAttendanceRow = AttendanceRecord & {
  employeeName: string
  employeeEmail: string
  department: string
  sourceType?: "attendance" | "synthetic_absent"
}

type RangeDataResult = {
  attendanceRows: DashboardAttendanceRow[]
  summaryRows: AttendanceSummaryRow[]
}

type DbUser = {
  id: string
  name: string
  email: string
  department: string | null
  shift_id: string | null
}

type DbShift = {
  id: string
  location_id: string | null
}

type DbHoliday = {
  id: string
  name: string
  holiday_date: string
  location_id: string | null
}

type DbRestDay = {
  id: string
  user_id: string
  day_of_week: string
  effective_from: string | null
  effective_to: string | null
}

const mapAttendance = (row: any): AttendanceRecord => ({
  id: row.id,
  userId: row.user_id,
  clockIn: row.clock_in,
  clockOut: row.clock_out,
  date: row.date,
  status: row.status,
  locationId: row.location_id,
  shiftId: row.shift_id,
  scheduledStart: row.scheduled_start,
  scheduledEnd: row.scheduled_end,
  minutesLate: row.minutes_late ?? 0,
  minutesOvertime: row.minutes_overtime ?? 0,
  isLate: row.is_late ?? false,
  isOvertime: row.is_overtime ?? false,
  isAbsent: row.is_absent ?? false,
  remarks: row.remarks ?? "",
  approvedOvertimeMinutes: row.approved_overtime_minutes ?? 0,
  overtimeStatus: row.overtime_status ?? "",
  isHoliday: row.is_holiday ?? false,
  isRestDay: row.is_restday ?? false,
  holidayName: row.holiday_name ?? "",
  createdAt: row.created_at,
})

const formatDateOnly = (date: Date) => {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, "0")
  const day = `${date.getDate()}`.padStart(2, "0")
  return `${year}-${month}-${day}`
}

const getDatesBetween = (startDate: string, endDate: string) => {
  const dates: string[] = []
  const current = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)

  while (current <= end) {
    dates.push(formatDateOnly(current))
    current.setDate(current.getDate() + 1)
  }

  return dates
}

const normalizeDayName = (value: string) => value.trim().toLowerCase()

const getDayNames = (dateString: string) => {
  const date = new Date(`${dateString}T00:00:00`)
  const long = date.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase()
  const short = date.toLocaleDateString("en-US", { weekday: "short" }).toLowerCase()

  return [long, short]
}

const isRestDayForDate = (
  restDays: DbRestDay[],
  userId: string,
  dateString: string
) => {
  const dayNames = getDayNames(dateString)

  return restDays.some((item) => {
    if (item.user_id !== userId) return false

    const restDayName = normalizeDayName(item.day_of_week)
    const matchesDay = dayNames.includes(restDayName)

    if (!matchesDay) return false

    if (item.effective_from && dateString < item.effective_from) return false
    if (item.effective_to && dateString > item.effective_to) return false

    return true
  })
}

const findHolidayForDate = (
  holidays: DbHoliday[],
  dateString: string,
  locationId: string | null
) => {
  return holidays.find((holiday) => {
    if (holiday.holiday_date !== dateString) return false

    if (!holiday.location_id) return true
    if (!locationId) return false

    return holiday.location_id === locationId
  })
}

const createSyntheticAbsentRecord = (
  user: DbUser,
  locationId: string | null,
  dateString: string
): DashboardAttendanceRow => ({
  id: `synthetic-absent-${user.id}-${dateString}`,
  userId: user.id,
  clockIn: null,
  clockOut: null,
  date: dateString,
  status: "absent",
  locationId,
  shiftId: user.shift_id,
  scheduledStart: null,
  scheduledEnd: null,
  minutesLate: 0,
  minutesOvertime: 0,
  isLate: false,
  isOvertime: false,
  isAbsent: true,
  remarks: "System-generated absent record",
  approvedOvertimeMinutes: 0,
  overtimeStatus: null,
  isHoliday: false,
  isRestDay: false,
  holidayName: null,
  createdAt: new Date().toISOString(),
  employeeName: user.name || "Unknown",
  employeeEmail: user.email || "",
  department: user.department || "",
  sourceType: "synthetic_absent",
})

const decorateAttendance = (
  record: AttendanceRecord,
  user: DbUser | undefined
): DashboardAttendanceRow => ({
  ...record,
  employeeName: user?.name || "Unknown",
  employeeEmail: user?.email || "",
  department: user?.department || "",
  sourceType: "attendance",
})

export const attendanceSummaryService = {
  async getRangeData(startDate: string, endDate: string): Promise<RangeDataResult> {
    const [
      usersRes,
      shiftsRes,
      attendanceRes,
      holidaysRes,
      restDaysRes,
    ] = await Promise.all([
      supabase.from("users").select("id, name, email, department, shift_id").order("name"),
      supabase.from("shifts").select("id, location_id"),
      supabase
        .from("attendance")
        .select("*")
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: false }),
      supabase
        .from("holidays")
        .select("id, name, holiday_date, location_id")
        .gte("holiday_date", startDate)
        .lte("holiday_date", endDate),
      supabase.from("user_rest_days").select("id, user_id, day_of_week, effective_from, effective_to"),
    ])

    if (usersRes.error) throw usersRes.error
    if (shiftsRes.error) throw shiftsRes.error
    if (attendanceRes.error) throw attendanceRes.error
    if (holidaysRes.error) throw holidaysRes.error
    if (restDaysRes.error) throw restDaysRes.error

    const users = (usersRes.data || []) as DbUser[]
    const shifts = (shiftsRes.data || []) as DbShift[]
    const holidays = (holidaysRes.data || []) as DbHoliday[]
    const restDays = (restDaysRes.data || []) as DbRestDay[]
    const attendance = (attendanceRes.data || []).map(mapAttendance)

    const shiftLocationMap = new Map<string, string | null>()
    shifts.forEach((shift) => {
      shiftLocationMap.set(shift.id, shift.location_id)
    })

    const userMap = new Map<string, DbUser>()
    users.forEach((user) => {
      userMap.set(user.id, user)
    })

    const attendanceByUserDate = new Map<string, AttendanceRecord>()
    attendance.forEach((record) => {
      attendanceByUserDate.set(`${record.userId}__${record.date}`, record)
    })

    const dateList = getDatesBetween(startDate, endDate)

    const detailedRows: DashboardAttendanceRow[] = []
    const summaryMap = new Map<string, AttendanceSummaryRow>()

    users.forEach((user) => {
      const userLocationId = user.shift_id
        ? (shiftLocationMap.get(user.shift_id) ?? null)
        : null

      summaryMap.set(user.id, {
        userId: user.id,
        name: user.name || "Unknown",
        email: user.email || "",
        department: user.department || "",
        locationId: userLocationId,
        presentDays: 0,
        absentDays: 0,
        workedHolidayDays: 0,
        workedHolidayRestDayDays: 0,
        workedRestDayDays: 0,
        restDays: 0,
        totalCountedDays: 0,
      })

      dateList.forEach((dateString) => {
        const holiday = findHolidayForDate(holidays, dateString, userLocationId)
        const isHoliday = Boolean(holiday)
        const isRestDay = isRestDayForDate(restDays, user.id, dateString)
        const existing = attendanceByUserDate.get(`${user.id}__${dateString}`)
        const summary = summaryMap.get(user.id)!

        if (existing) {
          const decorated = decorateAttendance(existing, user)
          detailedRows.push(decorated)

          summary.totalCountedDays += 1

          switch (existing.status) {
            case "present":
            case "late":
            case "overtime":
            case "late_overtime":
              summary.presentDays += 1
              break

            case "absent":
              summary.absentDays += 1
              break

            case "worked_holiday":
              summary.workedHolidayDays += 1
              break

            case "worked_holiday_restday":
              summary.workedHolidayRestDayDays += 1
              break

            case "worked_restday":
              summary.workedRestDayDays += 1
              break

            case "restday":
              summary.restDays += 1
              break
          }

          return
        }

        if (isHoliday && isRestDay) {
          return
        }

        if (isHoliday) {
          return
        }

        if (isRestDay) {
          summary.restDays += 1
          return
        }

        const syntheticAbsent = createSyntheticAbsentRecord(
          user,
          userLocationId,
          dateString
        )

        detailedRows.push(syntheticAbsent)
        summary.absentDays += 1
        summary.totalCountedDays += 1
      })
    })

    detailedRows.sort((a, b) => {
      if (a.date === b.date) {
        return a.employeeName.localeCompare(b.employeeName)
      }
      return a.date < b.date ? 1 : -1
    })

    const summaryRows = Array.from(summaryMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    )

    return {
      attendanceRows: detailedRows,
      summaryRows,
    }
  },
}