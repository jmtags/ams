import { supabase } from "../lib/supabase";

export type EmploymentType = "regular" | "part_time";
type CompensationEligibility = {
  employment_type: EmploymentType;
  effective_from: string;
  effective_to: string | null;
  is_active: boolean;
};

export const employmentTypeOnDate = (
  compensations: CompensationEligibility[],
  date: string
): EmploymentType => {
  const applicable = compensations
    .filter(row => row.is_active && row.effective_from <= date &&
      (!row.effective_to || row.effective_to >= date))
    .sort((a, b) => b.effective_from.localeCompare(a.effective_from));
  return applicable[0]?.employment_type ?? "regular";
};

export const overtimeEligibilityService = {
  async getEmploymentType(userId: string, date: string): Promise<EmploymentType> {
    if (!userId || !/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) {
      throw new Error("Employee and attendance date are required to check overtime eligibility.");
    }
    const { data, error } = await supabase
      .from("employee_compensation")
      .select("employment_type,effective_from,effective_to,is_active")
      .eq("user_id", userId)
      .eq("is_active", true)
      .lte("effective_from", date)
      .or(`effective_to.is.null,effective_to.gte.${date}`)
      .order("effective_from", { ascending: false })
      .limit(1);
    if (error) throw error;
    return employmentTypeOnDate(data ?? [], date);
  },

  async normalizeAttendance(userId: string, date: string, payload: any) {
    if (await this.getEmploymentType(userId, date) !== "part_time") return payload;
    return {
      ...payload,
      is_overtime: false,
      minutes_overtime: 0,
      approved_overtime_minutes: 0,
      overtime_status: "rejected",
      ...(payload.status === "late_overtime" ? { status: "late" } :
        payload.status === "overtime" ? { status: "present" } : {}),
    };
  },
};
