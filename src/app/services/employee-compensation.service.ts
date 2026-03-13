import { supabase } from "../lib/supabase";

export type PayType = "monthly" | "daily" | "hourly";

export type EmployeeCompensation = {
  id: string;
  user_id: string;
  pay_type: PayType;
  basic_monthly_rate: number;
  daily_rate: number;
  hourly_rate: number;
  allowance_amount: number;
  overtime_hourly_rate: number;
  late_deduction_mode: "none" | "per_minute" | "per_hour" | "fixed";
  late_deduction_rate: number;
  undertime_deduction_rate: number;
  absent_deduction_rate: number;
  effective_from: string;
  effective_to: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;

  user_name?: string;
  user_email?: string | null;
};

export type SaveEmployeeCompensationPayload = {
  user_id: string;
  pay_type: PayType;
  basic_monthly_rate?: number;
  daily_rate?: number;
  hourly_rate?: number;
  allowance_amount?: number;
  overtime_hourly_rate?: number;
  late_deduction_mode?: "none" | "per_minute" | "per_hour" | "fixed";
  late_deduction_rate?: number;
  undertime_deduction_rate?: number;
  absent_deduction_rate?: number;
  effective_from: string;
  effective_to?: string | null;
  is_active?: boolean;
};

const mapCompensation = (row: any): EmployeeCompensation => ({
  id: row.id,
  user_id: row.user_id,
  pay_type: row.pay_type,
  basic_monthly_rate: Number(row.basic_monthly_rate ?? 0),
  daily_rate: Number(row.daily_rate ?? 0),
  hourly_rate: Number(row.hourly_rate ?? 0),
  allowance_amount: Number(row.allowance_amount ?? 0),
  overtime_hourly_rate: Number(row.overtime_hourly_rate ?? 0),
  late_deduction_mode: row.late_deduction_mode ?? "per_minute",
  late_deduction_rate: Number(row.late_deduction_rate ?? 0),
  undertime_deduction_rate: Number(row.undertime_deduction_rate ?? 0),
  absent_deduction_rate: Number(row.absent_deduction_rate ?? 0),
  effective_from: row.effective_from,
  effective_to: row.effective_to ?? null,
  is_active: Boolean(row.is_active),
  created_at: row.created_at,
  updated_at: row.updated_at,
  user_name: row.users?.name ?? "",
  user_email: row.users?.email ?? null,
});

export const employeeCompensationService = {
  async getAll(): Promise<EmployeeCompensation[]> {
    const { data, error } = await supabase
      .from("employee_compensation")
      .select(`
        *,
        users (
          id,
          name,
          email
        )
      `)
      .order("effective_from", { ascending: false });

    if (error) throw error;
    return (data ?? []).map(mapCompensation);
  },

  async getByUser(userId: string): Promise<EmployeeCompensation[]> {
    const { data, error } = await supabase
      .from("employee_compensation")
      .select(`
        *,
        users (
          id,
          name,
          email
        )
      `)
      .eq("user_id", userId)
      .order("effective_from", { ascending: false });

    if (error) throw error;
    return (data ?? []).map(mapCompensation);
  },

  async getActiveByUser(userId: string): Promise<EmployeeCompensation | null> {
    const { data, error } = await supabase
      .from("employee_compensation")
      .select(`
        *,
        users (
          id,
          name,
          email
        )
      `)
      .eq("user_id", userId)
      .eq("is_active", true)
      .is("effective_to", null)
      .order("effective_from", { ascending: false })
      .maybeSingle();

    if (error) throw error;
    return data ? mapCompensation(data) : null;
  },

  async create(payload: SaveEmployeeCompensationPayload): Promise<EmployeeCompensation> {
    const { data, error } = await supabase
      .from("employee_compensation")
      .insert({
        user_id: payload.user_id,
        pay_type: payload.pay_type,
        basic_monthly_rate: payload.basic_monthly_rate ?? 0,
        daily_rate: payload.daily_rate ?? 0,
        hourly_rate: payload.hourly_rate ?? 0,
        allowance_amount: payload.allowance_amount ?? 0,
        overtime_hourly_rate: payload.overtime_hourly_rate ?? 0,
        late_deduction_mode: payload.late_deduction_mode ?? "per_minute",
        late_deduction_rate: payload.late_deduction_rate ?? 0,
        undertime_deduction_rate: payload.undertime_deduction_rate ?? 0,
        absent_deduction_rate: payload.absent_deduction_rate ?? 0,
        effective_from: payload.effective_from,
        effective_to: payload.effective_to ?? null,
        is_active: payload.is_active ?? true,
      })
      .select(`
        *,
        users (
          id,
          name,
          email
        )
      `)
      .single();

    if (error) throw error;
    return mapCompensation(data);
  },

  async update(id: string, payload: Partial<SaveEmployeeCompensationPayload>): Promise<EmployeeCompensation> {
    const { data, error } = await supabase
      .from("employee_compensation")
      .update({
        ...payload,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select(`
        *,
        users (
          id,
          name,
          email
        )
      `)
      .single();

    if (error) throw error;
    return mapCompensation(data);
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase
      .from("employee_compensation")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },
};