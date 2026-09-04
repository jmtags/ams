import { useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
import { toZonedTime } from "date-fns-tz"
import * as XLSX from "xlsx"
import { saveAs } from "file-saver"

import { AdminLayout } from "../layouts/admin-layout"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table"
import { Badge } from "../components/ui/badge"

import { departmentService } from "../services/department.service"
import { locationService } from "../services/location.service"
import { userService } from "../services/user.service"
import {
  attendanceSummaryService,
  type AttendanceSummaryRow,
} from "../services/attendance-summary.service"

import type { Department, Location, User, AttendanceRecord } from "../lib/types"

type DashboardAttendanceRow = AttendanceRecord & {
  employeeName: string
  employeeEmail: string
  department: string
  scheduledStart?: string | null
  scheduledEnd?: string | null
  minutesLate?: number
  minutesOvertime?: number
  isLate?: boolean
  isOvertime?: boolean
  isAbsent?: boolean
  isHoliday?: boolean
  isRestDay?: boolean
  holidayName?: string | null
  remarks?: string | null
  sourceType?: "attendance" | "synthetic_absent" | "synthetic_leave"
  leaveTypeName?: string | null
  leaveTypeCode?: string | null
  leaveReason?: string | null
  isApprovedLeave?: boolean
  leaveDayValue?: number
  leaveRequestId?: string | null
}

type AttendanceHeatmapDay = {
  date: string
  dayIndex: number
  title: string
  className: string
  monthLabel?: string
}

const dayLabels = ["", "Mon", "", "Wed", "", "Fri", ""]

const presentStatuses = new Set([
  "present",
  "overtime",
  "worked_holiday",
  "worked_restday",
  "worked_holiday_restday",
])

const lateStatuses = new Set(["late", "late_overtime"])

const holidayStatuses = new Set(["holiday", "holiday_restday"])

const parseLocalDate = (value: string) => {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(year, month - 1, day)
}

const formatDateKey = (date: Date) => format(date, "yyyy-MM-dd")

const getDateRange = (start: string, end: string) => {
  const startDate = parseLocalDate(start)
  const endDate = parseLocalDate(end)

  if (
    !Number.isFinite(startDate.getTime()) ||
    !Number.isFinite(endDate.getTime()) ||
    startDate > endDate
  ) {
    return []
  }

  const dates: Date[] = []
  const cursor = new Date(startDate)

  while (cursor <= endDate) {
    dates.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }

  return dates
}

const getTodayDate = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = `${now.getMonth() + 1}`.padStart(2, "0")
  const day = `${now.getDate()}`.padStart(2, "0")
  return `${year}-${month}-${day}`
}

const getFirstDayOfCurrentMonth = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = `${now.getMonth() + 1}`.padStart(2, "0")
  return `${year}-${month}-01`
}

export function AdminDashboardPage() {
  const [users, setUsers] = useState<User[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [locations, setLocations] = useState<Location[]>([])

  const [attendanceRows, setAttendanceRows] = useState<DashboardAttendanceRow[]>([])
  const [summaryRows, setSummaryRows] = useState<AttendanceSummaryRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showUserSummary, setShowUserSummary] = useState(false)

  const [searchTerm, setSearchTerm] = useState("")
  const [startDate, setStartDate] = useState(getFirstDayOfCurrentMonth())
  const [endDate, setEndDate] = useState(getTodayDate())
  const [selectedDepartment, setSelectedDepartment] = useState("")
  const [selectedLocation, setSelectedLocation] = useState("")

  const [page, setPage] = useState(1)
  const pageSize = 10

  useEffect(() => {
    loadReferenceData()
  }, [])

  useEffect(() => {
    if (!startDate || !endDate) return
    loadRangeData()
  }, [startDate, endDate])

  useEffect(() => {
    setPage(1)
  }, [searchTerm, startDate, endDate, selectedDepartment, selectedLocation])

  const loadReferenceData = async () => {
    try {
      const [usersData, departmentsData, locationsData] = await Promise.all([
        userService.getUsers(),
        departmentService.getAllDepartments(),
        locationService.getAllLocations(),
      ])

      setUsers(usersData || [])
      setDepartments(departmentsData || [])
      setLocations(locationsData || [])
    } catch (error) {
      console.error("Failed to load reference data:", error)
    }
  }

  const loadRangeData = async () => {
    setIsLoading(true)

    try {
      const result = await attendanceSummaryService.getRangeData(startDate, endDate)
      setAttendanceRows(result.attendanceRows as DashboardAttendanceRow[])
      setSummaryRows(result.summaryRows)
    } catch (error) {
      console.error("Dashboard loading error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const formatPHTime = (dateString?: string | null) => {
    if (!dateString) return "-"
    const phDate = toZonedTime(new Date(dateString), "Asia/Manila")
    return format(phDate, "hh:mm a")
  }

  const getDiffHours = (
    start?: string | null,
    end?: string | null
  ): number | null => {
    if (!start || !end) return null

    const startTime = new Date(start).getTime()
    const endTime = new Date(end).getTime()

    if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) return null
    if (endTime <= startTime) return null

    return (endTime - startTime) / 3600000
  }

  const formatHours = (value: number | null) => {
    if (value === null) return "-"
    return `${value.toFixed(2)} hrs`
  }

  const getRenderedHours = (record: DashboardAttendanceRow) =>
    getDiffHours(record.clockIn, record.clockOut)

  const getAssumedShiftHours = (record: DashboardAttendanceRow) => {
    if (!record.clockIn || record.clockOut) return null
    return getDiffHours(record.scheduledStart, record.scheduledEnd)
  }

  const getLocationName = (locationId?: string | null) => {
    if (!locationId) return "-"
    const location = locations.find((loc) => loc.id === locationId)
    return location?.name || "-"
  }

  const formatStatusLabel = (status: string) => {
    switch (status) {
      case "present":
        return "Present"
      case "late":
        return "Late"
      case "overtime":
        return "Overtime"
      case "late_overtime":
        return "Late + Overtime"
      case "absent":
        return "Absent"
      case "holiday":
        return "Holiday"
      case "restday":
        return "Rest Day"
      case "holiday_restday":
        return "Holiday + Rest Day"
      case "worked_holiday":
        return "Worked Holiday"
      case "worked_restday":
        return "Worked Rest Day"
      case "worked_holiday_restday":
        return "Worked Holiday + Rest Day"
      case "approved_leave":
        return "Approved Leave"
      default:
        return status || "-"
    }
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "present":
        return "default"
      case "late":
      case "overtime":
      case "late_overtime":
        return "secondary"
      case "absent":
        return "destructive"
      case "approved_leave":
        return "outline"
      case "holiday":
      case "restday":
      case "holiday_restday":
        return "outline"
      case "worked_holiday":
      case "worked_restday":
      case "worked_holiday_restday":
        return "default"
      default:
        return "outline"
    }
  }

  const filteredAttendance = useMemo(() => {
    return attendanceRows.filter((record) => {
      if (
        searchTerm &&
        !record.employeeName.toLowerCase().includes(searchTerm.toLowerCase())
      ) {
        return false
      }

      if (selectedDepartment && record.department !== selectedDepartment) {
        return false
      }

      if (selectedLocation && record.locationId !== selectedLocation) {
        return false
      }

      return true
    })
  }, [attendanceRows, searchTerm, selectedDepartment, selectedLocation])

  const filteredSummaryRows = useMemo(() => {
    return summaryRows.filter((row) => {
      if (searchTerm && !row.name.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false
      }

      if (selectedDepartment && row.department !== selectedDepartment) {
        return false
      }

      if (selectedLocation && row.locationId !== selectedLocation) {
        return false
      }

      return true
    })
  }, [summaryRows, searchTerm, selectedDepartment, selectedLocation])

  const totalPages = Math.max(1, Math.ceil(filteredAttendance.length / pageSize))

  const paginatedAttendance = filteredAttendance.slice(
    (page - 1) * pageSize,
    page * pageSize
  )

  const totalAbsentCount = filteredAttendance.filter(
    (record) => record.status === "absent"
  ).length

  const totalApprovedLeaveCount = filteredAttendance.filter(
    (record) => record.status === "approved_leave"
  ).length

  const exportToExcel = () => {
    const data = filteredAttendance.map((record) => ({
      Employee: record.employeeName || "",
      Email: record.employeeEmail || "",
      Department: record.department || "",
      Location: getLocationName(record.locationId),
      Date: record.date || "",
      ClockIn: record.clockIn ? formatPHTime(record.clockIn) : "",
      ClockOut: record.clockOut ? formatPHTime(record.clockOut) : "",
      RenderedHours: getRenderedHours(record) ?? "",
      AssumedShiftHours: getAssumedShiftHours(record) ?? "",
      Status: formatStatusLabel(record.status),
      LeaveType: record.leaveTypeName || "",
      LeaveCode: record.leaveTypeCode || "",
      LeaveDayValue: record.leaveDayValue ?? "",
      LeaveReason: record.leaveReason || "",
      LateMinutes: record.minutesLate || 0,
      OvertimeMinutes: record.minutesOvertime || 0,
      IsLate: record.isLate ? "Yes" : "No",
      IsOvertime: record.isOvertime ? "Yes" : "No",
      IsAbsent: record.isAbsent ? "Yes" : "No",
      IsApprovedLeave: record.isApprovedLeave ? "Yes" : "No",
      IsHoliday: record.isHoliday ? "Yes" : "No",
      IsRestDay: record.isRestDay ? "Yes" : "No",
      HolidayName: record.holidayName || "",
      ScheduledStart: record.scheduledStart ? formatPHTime(record.scheduledStart) : "",
      ScheduledEnd: record.scheduledEnd ? formatPHTime(record.scheduledEnd) : "",
      Remarks: record.remarks || "",
      RecordSource:
        record.sourceType === "synthetic_absent"
          ? "System-generated absent"
          : record.sourceType === "synthetic_leave"
          ? "System-generated approved leave"
          : "Attendance record",
    }))

    const worksheet = XLSX.utils.json_to_sheet(data)
    const workbook = XLSX.utils.book_new()

    worksheet["!cols"] = [
      { wch: 24 },
      { wch: 28 },
      { wch: 18 },
      { wch: 18 },
      { wch: 14 },
      { wch: 12 },
      { wch: 12 },
      { wch: 14 },
      { wch: 18 },
      { wch: 22 },
      { wch: 20 },
      { wch: 12 },
      { wch: 12 },
      { wch: 30 },
      { wch: 14 },
      { wch: 16 },
      { wch: 10 },
      { wch: 12 },
      { wch: 12 },
      { wch: 16 },
      { wch: 12 },
      { wch: 12 },
      { wch: 20 },
      { wch: 14 },
      { wch: 14 },
      { wch: 30 },
      { wch: 30 },
    ]

    XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance")

    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    })

    const blob = new Blob([excelBuffer], {
      type: "application/octet-stream",
    })

    saveAs(blob, `attendance-report-${startDate}-to-${endDate}.xlsx`)
  }

  const exportUserSummaryToExcel = () => {
    const data = filteredSummaryRows.map((row) => ({
      Employee: row.name,
      Email: row.email,
      Department: row.department,
      Location: getLocationName(row.locationId),
      PresentDays: row.presentDays,
      AbsentDays: row.absentDays,
      LeaveDays: row.leaveDays,
      WorkedHolidayDays: row.workedHolidayDays,
      WorkedHolidayRestDayDays: row.workedHolidayRestDayDays,
      WorkedRestDayDays: row.workedRestDayDays,
      RestDays: row.restDays,
      TotalCountedDays: row.totalCountedDays,
      DateRange: `${startDate} to ${endDate}`,
    }))

    const worksheet = XLSX.utils.json_to_sheet(data)
    const workbook = XLSX.utils.book_new()

    worksheet["!cols"] = [
      { wch: 24 },
      { wch: 28 },
      { wch: 18 },
      { wch: 18 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 18 },
      { wch: 24 },
      { wch: 18 },
      { wch: 12 },
      { wch: 16 },
      { wch: 24 },
    ]

    XLSX.utils.book_append_sheet(workbook, worksheet, "User Summary")

    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    })

    const blob = new Blob([excelBuffer], {
      type: "application/octet-stream",
    })

    saveAs(blob, `attendance-user-summary-${startDate}-to-${endDate}.xlsx`)
  }

  const attendanceHeatmap = useMemo(() => {
    const recordsByDate = new Map<string, DashboardAttendanceRow[]>()

    filteredAttendance.forEach((record) => {
      if (!record.date) return
      const existing = recordsByDate.get(record.date) ?? []
      existing.push(record)
      recordsByDate.set(record.date, existing)
    })

    const dates = getDateRange(startDate, endDate)
    const firstDayOffset = dates[0]?.getDay() ?? 0
    const cells: AttendanceHeatmapDay[] = []

    for (let index = 0; index < firstDayOffset; index += 1) {
      cells.push({
        date: `empty-start-${index}`,
        dayIndex: index,
        title: "",
        className: "bg-transparent",
      })
    }

    dates.forEach((date, index) => {
      const dateKey = formatDateKey(date)
      const records = recordsByDate.get(dateKey) ?? []
      const presentCount = records.filter((record) =>
        presentStatuses.has(record.status)
      ).length
      const lateCount = records.filter((record) =>
        lateStatuses.has(record.status)
      ).length
      const absentCount = records.filter((record) => record.status === "absent")
        .length
      const leaveCount = records.filter(
        (record) => record.status === "approved_leave"
      ).length
      const holidayCount = records.filter((record) =>
        holidayStatuses.has(record.status)
      ).length
      const restDayCount = records.filter((record) => record.status === "restday")
        .length
      const totalCount = records.length
      const attendedCount = presentCount + lateCount
      const attendanceRate = totalCount > 0 ? attendedCount / totalCount : 0
      const absentRate = totalCount > 0 ? absentCount / totalCount : 0
      const lateRate = totalCount > 0 ? lateCount / totalCount : 0

      let className = "bg-neutral-200"

      if (totalCount === 0) {
        className = "bg-neutral-200"
      } else if (absentRate >= 0.25) {
        className = "bg-red-500"
      } else if (lateRate >= 0.25) {
        className = "bg-amber-400"
      } else if (attendanceRate >= 0.9) {
        className = "bg-emerald-600"
      } else if (attendanceRate >= 0.7) {
        className = "bg-emerald-500"
      } else if (attendanceRate > 0) {
        className = "bg-lime-400"
      } else if (leaveCount > 0) {
        className = "bg-cyan-400"
      } else if (holidayCount > 0 || restDayCount > 0) {
        className = "bg-sky-300"
      }

      cells.push({
        date: dateKey,
        dayIndex: date.getDay(),
        title: `${format(date, "MMM d, yyyy")}: ${totalCount} record${
          totalCount === 1 ? "" : "s"
        } | Present ${presentCount}, Late ${lateCount}, Absent ${absentCount}, Leave ${leaveCount}, Holiday/Rest ${holidayCount + restDayCount}`,
        className,
        monthLabel:
          date.getDate() <= 7 && (index === 0 || date.getDate() === 1)
            ? format(date, "MMM")
            : undefined,
      })
    })

    const weekCount = Math.max(1, Math.ceil(cells.length / 7))

    return {
      cells,
      weekCount,
      hasRecords: filteredAttendance.length > 0,
    }
  }, [filteredAttendance, startDate, endDate])

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <p>Loading...</p>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Dashboard</h1>
          <p className="text-neutral-600">
            Overview of your attendance monitoring system
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
          <Card>
            <CardContent className="pt-6">
              <p>Total Users</p>
              <p className="text-3xl font-bold">{users.length}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <p>Departments</p>
              <p className="text-3xl font-bold">{departments.length}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <p>Locations</p>
              <p className="text-3xl font-bold">{locations.length}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <p>Total Records in Range</p>
              <p className="text-3xl font-bold">{filteredAttendance.length}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <p>Absents in Range</p>
              <p className="text-3xl font-bold text-red-600">{totalAbsentCount}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <p>Approved Leaves</p>
              <p className="text-3xl font-bold text-cyan-600">{totalApprovedLeaveCount}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Attendance Heatmap</CardTitle>
            <CardDescription>
              Daily attendance health based on filtered records
            </CardDescription>
          </CardHeader>

          <CardContent>
            {!attendanceHeatmap.hasRecords ? (
              <div className="h-[220px] flex items-center justify-center text-neutral-500">
                No attendance data available for the selected filters.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto pb-2">
                  <div
                    className="grid gap-1 min-w-max"
                    style={{
                      gridTemplateColumns: `32px repeat(${attendanceHeatmap.weekCount}, 14px)`,
                      gridTemplateRows: "20px repeat(7, 14px)",
                    }}
                  >
                    <div />
                    {Array.from({ length: attendanceHeatmap.weekCount }).map(
                      (_, weekIndex) => {
                        const monthLabel = attendanceHeatmap.cells.find(
                          (cell, cellIndex) =>
                            Math.floor(cellIndex / 7) === weekIndex &&
                            cell.monthLabel
                        )?.monthLabel

                        return (
                          <div
                            key={`month-${weekIndex}`}
                            className="text-[10px] leading-none text-neutral-500"
                          >
                            {monthLabel}
                          </div>
                        )
                      }
                    )}

                    {dayLabels.map((label, index) => (
                      <div
                        key={`day-${index}`}
                        className="text-[10px] leading-[14px] text-neutral-500"
                        style={{ gridColumn: 1, gridRow: index + 2 }}
                      >
                        {label}
                      </div>
                    ))}

                    {attendanceHeatmap.cells.map((cell, index) => (
                      <div
                        key={cell.date}
                        title={cell.title}
                        aria-label={cell.title || undefined}
                        className={`h-3.5 w-3.5 rounded-sm ${cell.className}`}
                        style={{
                          gridColumn: Math.floor(index / 7) + 2,
                          gridRow: cell.dayIndex + 2,
                        }}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-600">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-sm bg-emerald-600" />
                    High attendance
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-sm bg-lime-400" />
                    Partial attendance
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-sm bg-amber-400" />
                    Late trend
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-sm bg-red-500" />
                    Absence trend
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-sm bg-cyan-400" />
                    Approved leave
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-sm bg-sky-300" />
                    Holiday or rest day
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-sm bg-neutral-200" />
                    No record
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Attendance Filters</CardTitle>
            <CardDescription>
              Absence detection excludes approved leave dates.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="grid md:grid-cols-5 gap-4">
              <input
                type="text"
                placeholder="Search employee..."
                className="border rounded px-2 py-2"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />

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

              <select
                className="border rounded px-2 py-2"
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
              >
                <option value="">All Departments</option>
                {departments.map((dep) => (
                  <option key={dep.id} value={dep.name}>
                    {dep.name}
                  </option>
                ))}
              </select>

              <select
                className="border rounded px-2 py-2"
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
              >
                <option value="">All Locations</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3 mt-4 flex-wrap">
              <button
                onClick={exportToExcel}
                className="bg-green-600 text-white px-4 py-2 rounded"
              >
                Export Attendance to Excel
              </button>

              <button
                onClick={() => setShowUserSummary((prev) => !prev)}
                className="bg-blue-600 text-white px-4 py-2 rounded"
              >
                {showUserSummary ? "Hide User Summary" : "Show User Summary"}
              </button>

              <button
                onClick={exportUserSummaryToExcel}
                className="bg-purple-600 text-white px-4 py-2 rounded"
              >
                Export User Summary
              </button>

              <button
                onClick={() => {
                  setSearchTerm("")
                  setStartDate(getFirstDayOfCurrentMonth())
                  setEndDate(getTodayDate())
                  setSelectedDepartment("")
                  setSelectedLocation("")
                }}
                className="border px-4 py-2 rounded"
              >
                Reset Filters
              </button>
            </div>
          </CardContent>
        </Card>

        {showUserSummary && (
          <Card>
            <CardHeader>
              <CardTitle>User Attendance Summary</CardTitle>
              <CardDescription>
                Per-user summary from {startDate} to {endDate}
              </CardDescription>
            </CardHeader>

            <CardContent>
              <Table
                containerClassName="max-h-[70vh]"
                className="min-w-[1100px]"
              >
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Present</TableHead>
                    <TableHead>Absent</TableHead>
                    <TableHead>Leave</TableHead>
                    <TableHead>Worked Holiday</TableHead>
                    <TableHead>Worked Holiday + Rest Day</TableHead>
                    <TableHead>Worked Rest Day</TableHead>
                    <TableHead>Rest Days</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {filteredSummaryRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-6">
                        No summary records found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSummaryRows.map((row) => (
                      <TableRow key={row.userId}>
                        <TableCell>{row.name}</TableCell>
                        <TableCell>{row.department || "-"}</TableCell>
                        <TableCell>{getLocationName(row.locationId)}</TableCell>
                        <TableCell>{row.presentDays}</TableCell>
                        <TableCell>{row.absentDays}</TableCell>
                        <TableCell>{row.leaveDays}</TableCell>
                        <TableCell>{row.workedHolidayDays}</TableCell>
                        <TableCell>{row.workedHolidayRestDayDays}</TableCell>
                        <TableCell>{row.workedRestDayDays}</TableCell>
                        <TableCell>{row.restDays}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Attendance Records</CardTitle>
            <CardDescription>
              Filtered attendance data ({filteredAttendance.length} total)
            </CardDescription>
          </CardHeader>

          <CardContent>
            <Table
              containerClassName="max-h-[70vh]"
              className="min-w-[1400px]"
            >
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Clock In</TableHead>
                  <TableHead>Clock Out</TableHead>
                  <TableHead>Rendered Hours</TableHead>
                  <TableHead>Assumed Shift Hours</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Leave Type</TableHead>
                  <TableHead>Late</TableHead>
                  <TableHead>OT</TableHead>
                  <TableHead>Holiday</TableHead>
                  <TableHead>Rest Day</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {paginatedAttendance.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={14} className="text-center py-6">
                      No attendance records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedAttendance.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>{record.employeeName}</TableCell>
                      <TableCell>{record.department || "-"}</TableCell>
                      <TableCell>{getLocationName(record.locationId)}</TableCell>
                      <TableCell>{record.date || "-"}</TableCell>
                      <TableCell>
                        {record.clockIn ? formatPHTime(record.clockIn) : "-"}
                      </TableCell>
                      <TableCell>
                        {record.clockOut ? formatPHTime(record.clockOut) : "-"}
                      </TableCell>
                      <TableCell>{formatHours(getRenderedHours(record))}</TableCell>
                      <TableCell>
                        {formatHours(getAssumedShiftHours(record))}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(record.status)}>
                          {formatStatusLabel(record.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {record.status === "approved_leave"
                          ? `${record.leaveTypeName || "Leave"}${
                              record.leaveDayValue && record.leaveDayValue < 1
                                ? ` (${record.leaveDayValue})`
                                : ""
                            }`
                          : "-"}
                      </TableCell>
                      <TableCell>{record.minutesLate || 0}</TableCell>
                      <TableCell>{record.minutesOvertime || 0}</TableCell>
                      <TableCell>
                        {record.isHoliday ? record.holidayName || "Yes" : "-"}
                      </TableCell>
                      <TableCell>{record.isRestDay ? "Yes" : "-"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            <div className="flex justify-center items-center gap-3 mt-4">
              <button
                className="border px-3 py-1 rounded disabled:opacity-50"
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
              >
                Prev
              </button>

              <span>
                Page {page} of {totalPages}
              </span>

              <button
                className="border px-3 py-1 rounded disabled:opacity-50"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              >
                Next
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
