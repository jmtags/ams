import { useEffect, useState } from "react"
import { AdminLayout } from "../layouts/admin-layout"
import { attendanceService } from "../services/attendance.service"

export function AdminReportsPage() {

const [attendance,setAttendance] = useState([])

useEffect(()=>{
loadReport()
},[])

const loadReport = async () => {

const data = await attendanceService.getAllAttendance()

setAttendance(data)

}

const monthlyStats = {}

attendance.forEach((record)=>{

const month = record.date.slice(0,7)

if(!monthlyStats[month]){

monthlyStats[month] = {
present:0,
late:0,
absent:0
}

}

monthlyStats[month][record.status]++

})

return(

<AdminLayout>

<h1 className="text-2xl mb-6">Monthly Attendance Report</h1>

<table className="w-full border">

<thead>
<tr>
<th>Month</th>
<th>Present</th>
<th>Late</th>
<th>Absent</th>
</tr>
</thead>

<tbody>

{Object.entries(monthlyStats).map(([month,data])=>(

<tr key={month}>
<td>{month}</td>
<td>{data.present}</td>
<td>{data.late}</td>
<td>{data.absent}</td>
</tr>

))}

</tbody>

</table>

</AdminLayout>

)

}