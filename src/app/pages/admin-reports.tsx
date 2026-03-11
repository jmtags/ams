import { useEffect, useMemo, useState } from "react"
import { AdminLayout } from "../layouts/admin-layout"
import {
  attendanceSummaryService,
} from "../services/attendance-summary.service"
import type { AttendanceRecord } from "../lib/types"

type DashboardAttendanceRow = AttendanceRecord & {
  employeeName: string
  employeeEmail: string
  department: string
  sourceType?: "attendance" | "synthetic_absent"
}

type MonthlyStatItem = {
  present: number
  late: number
  absent: number
  holiday: number
  restday: number
  overtime: number
  workedHoliday: number
  workedRestDay: number
  workedHolidayRestDay: number
  total: number
}

const getTodayDate = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = `${now.getMonth() + 1}`.padStart(2, "0")
  const day = `${now.getDate()}`.padStart(2, "0")
  return `${year}-${month}-${day}`
}

const getFirstDayOfCurrentYear = () => {
  const now = new Date()
  return `${now.getFullYear()}-01-01`
}

export function AdminReportsPage() {
  const [attendance, setAttendance] = useState<DashboardAttendanceRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [startDate, setStartDate] = useState(getFirstDayOfCurrentYear())
  const [endDate, setEndDate] = useState(getTodayDate())

  useEffect(() => {
    loadReport()
  }, [startDate, endDate])

  const loadReport = async () => {
    setIsLoading(true)

    try {
      const result = await attendanceSummaryService.getRangeData(startDate, endDate)
      setAttendance(result.attendanceRows)
    } catch (error) {
      console.error("Failed to load attendance report:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const monthlyStats = useMemo<Record<string, MonthlyStatItem>>(() => {
    const stats: Record<string, MonthlyStatItem> = {}

    attendance.forEach((record) => {
      const month = record.date?.slice(0, 7)
      if (!month) return

      if (!stats[month]) {
        stats[month] = {
          present: 0,
          late: 0,
          absent: 0,
          holiday: 0,
          restday: 0,
          overtime: 0,
          workedHoliday: 0,
          workedRestDay: 0,
          workedHolidayRestDay: 0,
          total: 0,
        }
      }

      stats[month].total += 1

      if (record.status === "present") {
        stats[month].present += 1
      } else if (record.status === "late") {
        stats[month].late += 1
      } else if (record.status === "absent") {
        stats[month].absent += 1
      } else if (record.status === "holiday") {
        stats[month].holiday += 1
      } else if (record.status === "restday") {
        stats[month].restday += 1
      } else if (record.status === "holiday_restday") {
        stats[month].holiday += 1
        stats[month].restday += 1
      } else if (record.status === "overtime") {
        stats[month].present += 1
        stats[month].overtime += 1
      } else if (record.status === "late_overtime") {
        stats[month].late += 1
        stats[month].overtime += 1
      } else if (record.status === "worked_holiday") {
        stats[month].workedHoliday += 1
      } else if (record.status === "worked_restday") {
        stats[month].workedRestDay += 1
      } else if (record.status === "worked_holiday_restday") {
        stats[month].workedHolidayRestDay += 1
      }
    })

    return stats
  }, [attendance])

  const sortedMonths = Object.keys(monthlyStats).sort((a, b) =>
    a < b ? 1 : -1
  )

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <p>Loading monthly report...</p>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold mb-1">
            Monthly Attendance Report
          </h1>
          <p className="text-neutral-600">
            Summary of attendance including system-generated absences
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <input
            type="date"
            className="border rounded px-2 py-2"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />

          <input
            type="date"
            className="border rounded px-2 py-2"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border border-collapse bg-white">
            <thead>
              <tr className="bg-neutral-100">
                <th className="border px-4 py-2 text-left">Month</th>
                <th className="border px-4 py-2 text-left">Present</th>
                <th className="border px-4 py-2 text-left">Late</th>
                <th className="border px-4 py-2 text-left">Absent</th>
                <th className="border px-4 py-2 text-left">Holiday</th>
                <th className="border px-4 py-2 text-left">Rest Day</th>
                <th className="border px-4 py-2 text-left">Overtime</th>
                <th className="border px-4 py-2 text-left">Worked Holiday</th>
                <th className="border px-4 py-2 text-left">Worked Rest Day</th>
                <th className="border px-4 py-2 text-left">
                  Worked Holiday + Rest Day
                </th>
                <th className="border px-4 py-2 text-left">Total Records</th>
              </tr>
            </thead>

            <tbody>
              {sortedMonths.length === 0 ? (
                <tr>
                  <td colSpan={11} className="border px-4 py-6 text-center">
                    No report data found.
                  </td>
                </tr>
              ) : (
                sortedMonths.map((month) => {
                  const data = monthlyStats[month]

                  return (
                    <tr key={month}>
                      <td className="border px-4 py-2">{month}</td>
                      <td className="border px-4 py-2">{data.present}</td>
                      <td className="border px-4 py-2">{data.late}</td>
                      <td className="border px-4 py-2">{data.absent}</td>
                      <td className="border px-4 py-2">{data.holiday}</td>
                      <td className="border px-4 py-2">{data.restday}</td>
                      <td className="border px-4 py-2">{data.overtime}</td>
                      <td className="border px-4 py-2">{data.workedHoliday}</td>
                      <td className="border px-4 py-2">{data.workedRestDay}</td>
                      <td className="border px-4 py-2">
                        {data.workedHolidayRestDay}
                      </td>
                      <td className="border px-4 py-2">{data.total}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  )
}