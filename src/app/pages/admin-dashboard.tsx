import { useState, useEffect } from "react"
import { Users, Building2, MapPin, Clock } from "lucide-react"

import { AdminLayout } from "../layouts/admin-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table"
import { Badge } from "../components/ui/badge"

import { userService } from "../services/user.service"
import { departmentService } from "../services/department.service"
import { locationService } from "../services/location.service"
import { attendanceService } from "../services/attendance.service"

import type { User, Department, Location, AttendanceRecord } from "../lib/types"

import { format } from "date-fns"
import { toZonedTime } from "date-fns-tz"

import * as XLSX from "xlsx"
import { saveAs } from "file-saver"

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts"

export function AdminDashboardPage() {

  const [users, setUsers] = useState<User[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [searchTerm, setSearchTerm] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [selectedDepartment, setSelectedDepartment] = useState("")
  const [selectedLocation, setSelectedLocation] = useState("")

  const [page, setPage] = useState(1)
  const pageSize = 10

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {

    setIsLoading(true)

    try {

      const [
        usersData,
        departmentsData,
        locationsData,
        attendanceData
      ] = await Promise.all([
        userService.getUsers(),
        departmentService.getAllDepartments(),
        locationService.getAllLocations(),
        attendanceService.getAllAttendance()
      ])

      setUsers(usersData || [])
      setDepartments(departmentsData || [])
      setLocations(locationsData || [])
      setAttendance(attendanceData || [])

    } catch (error) {

      console.error("Dashboard loading error:", error)

    } finally {

      setIsLoading(false)

    }

  }

  const formatPHDate = (dateString: string) => {
    const phDate = toZonedTime(new Date(dateString), "Asia/Manila")
    return format(phDate, "yyyy-MM-dd")
  }

  const formatPHTime = (dateString: string) => {
    const phDate = toZonedTime(new Date(dateString), "Asia/Manila")
    return format(phDate, "hh:mm a")
  }

  const getUserName = (userId: string) => {
    const user = users.find((u) => u.id === userId)
    return user?.name || "Unknown"
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "present":
        return "default"
      case "late":
        return "secondary"
      case "absent":
        return "destructive"
      default:
        return "outline"
    }
  }

  const filteredAttendance = attendance.filter((record) => {

    const user = users.find((u) => u.id === record.userId)

    if (!user) return false

    if (searchTerm && !user.name.toLowerCase().includes(searchTerm.toLowerCase()))
      return false

    if (startDate && record.date < startDate) return false
    if (endDate && record.date > endDate) return false

    if (selectedDepartment && user.department !== selectedDepartment)
      return false

    if (selectedLocation && record.locationId !== selectedLocation)
      return false

    return true
  })

  const paginatedAttendance = filteredAttendance.slice(
    (page - 1) * pageSize,
    page * pageSize
  )

  const exportToExcel = () => {

    const data = filteredAttendance.map((record) => {

      const user = users.find((u) => u.id === record.userId)

      return {
        Employee: user?.name,
        Date: record.date,
        ClockIn: record.clockIn,
        ClockOut: record.clockOut,
        Status: record.status
      }

    })

    const worksheet = XLSX.utils.json_to_sheet(data)
    const workbook = XLSX.utils.book_new()

    XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance")

    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array"
    })

    const blob = new Blob([excelBuffer], {
      type: "application/octet-stream"
    })

    saveAs(blob, "attendance.xlsx")
  }

  const chartData = [
    {
      name: "Present",
      value: attendance.filter((a) => a.status === "present").length
    },
    {
      name: "Late",
      value: attendance.filter((a) => a.status === "late").length
    },
    {
      name: "Absent",
      value: attendance.filter((a) => a.status === "absent").length
    }
  ]

  const chartColors = ["#22c55e", "#f59e0b", "#ef4444"]

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

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">

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
              <p>Total Attendance</p>
              <p className="text-3xl font-bold">{attendance.length}</p>
            </CardContent>
          </Card>

        </div>

        <Card>
          <CardHeader>
            <CardTitle>Attendance Overview</CardTitle>
          </CardHeader>

          <CardContent>

            <ResponsiveContainer width="100%" height={300}>

              <PieChart>

                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={100}
                  label
                >

                  {chartData.map((entry, index) => (
                    <Cell key={index} fill={chartColors[index]} />
                  ))}

                </Pie>

                <Tooltip />
                <Legend />

              </PieChart>

            </ResponsiveContainer>

          </CardContent>
        </Card>

        <Card>

          <CardHeader>
            <CardTitle>Attendance Filters</CardTitle>
          </CardHeader>

          <CardContent>

            <div className="grid md:grid-cols-5 gap-4">

              <input
                type="text"
                placeholder="Search employee..."
                className="border rounded px-2 py-1"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />

              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />

              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />

              <select
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

            <button
              onClick={exportToExcel}
              className="mt-4 bg-green-600 text-white px-4 py-2 rounded"
            >
              Export to Excel
            </button>

          </CardContent>

        </Card>

        <Card>

          <CardHeader>
            <CardTitle>Attendance Records</CardTitle>
            <CardDescription>Filtered attendance data</CardDescription>
          </CardHeader>

          <CardContent>

            <Table>

              <TableHeader>

                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Clock In</TableHead>
                  <TableHead>Clock Out</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>

              </TableHeader>

              <TableBody>

                {paginatedAttendance.map((record) => (

                  <TableRow key={record.id}>

                    <TableCell>
                      {getUserName(record.userId)}
                    </TableCell>

                    <TableCell>
                      {formatPHDate(record.date)}
                    </TableCell>

                    <TableCell>
                      {record.clockIn ? formatPHTime(record.clockIn) : "-"}
                    </TableCell>

                    <TableCell>
                      {record.clockOut ? formatPHTime(record.clockOut) : "-"}
                    </TableCell>

                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(record.status)}>
                        {record.status}
                      </Badge>
                    </TableCell>

                  </TableRow>

                ))}

              </TableBody>

            </Table>

            <div className="flex justify-center gap-3 mt-4">

              <button
                className="border px-3 py-1"
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
              >
                Prev
              </button>

              <span>Page {page}</span>

              <button
                className="border px-3 py-1"
                onClick={() => setPage((p) => p + 1)}
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