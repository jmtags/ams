import { supabase } from "../lib/supabase";

export type PayrollAdjustment = {
  id: string;
  payroll_period_id: string;
  user_id: string;
  adjustment_type: "addition" | "deduction";
  name: string;
  amount: number;
  notes: string | null;
  created_by: string | null;
  created_at?: string;

  user_name?: string;
  user_email?: string | null;
  payroll_period_name?: string;

  created_by_name?: string;
  created_by_email?: string | null;
};

export type SavePayrollAdjustmentPayload = {
  payroll_period_id: string;
  user_id: string;
  adjustment_type: "addition" | "deduction";
  name: string;
  amount: number;
  notes?: string | null;
  created_by?: string | null;
};

const mapAdjustment = (row: any): PayrollAdjustment => ({
  id: row.id,
  payroll_period_id: row.payroll_period_id,
  user_id: row.user_id,
  adjustment_type: row.adjustment_type,
  name: row.name,
  amount: Number(row.amount ?? 0),
  notes: row.notes ?? null,
  created_by: row.created_by ?? null,
  created_at: row.created_at,
  user_name: row.employee?.name ?? "",
  user_email: row.employee?.email ?? null,
  payroll_period_name: row.payroll_periods?.name ?? "",
  created_by_name: row.creator?.name ?? "",
  created_by_email: row.creator?.email ?? null,
});

export const payrollAdjustmentService = {
  async getAll(): Promise<PayrollAdjustment[]> {
    const { data, error } = await supabase
      .from("payroll_adjustments")
      .select(`
        *,
        employee:users!payroll_adjustments_user_id_fkey (
          id,
          name,
          email
        ),
        creator:users!payroll_adjustments_created_by_fkey (
          id,
          name,
          email
        ),
        payroll_periods (
          id,
          name
        )
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []).map(mapAdjustment);
  },

  async getByPayrollPeriod(payrollPeriodId: string): Promise<PayrollAdjustment[]> {
    const { data, error } = await supabase
      .from("payroll_adjustments")
      .select(`
        *,
        employee:users!payroll_adjustments_user_id_fkey (
          id,
          name,
          email
        ),
        creator:users!payroll_adjustments_created_by_fkey (
          id,
          name,
          email
        ),
        payroll_periods (
          id,
          name
        )
      `)
      .eq("payroll_period_id", payrollPeriodId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []).map(mapAdjustment);
  },

  async create(payload: SavePayrollAdjustmentPayload): Promise<PayrollAdjustment> {
    const { data, error } = await supabase
      .from("payroll_adjustments")
      .insert({
        payroll_period_id: payload.payroll_period_id,
        user_id: payload.user_id,
        adjustment_type: payload.adjustment_type,
        name: payload.name,
        amount: payload.amount,
        notes: payload.notes ?? null,
        created_by: payload.created_by ?? null,
      })
      .select(`
        *,
        employee:users!payroll_adjustments_user_id_fkey (
          id,
          name,
          email
        ),
        creator:users!payroll_adjustments_created_by_fkey (
          id,
          name,
          email
        ),
        payroll_periods (
          id,
          name
        )
      `)
      .single();

    if (error) throw error;
    return mapAdjustment(data);
  },

  async update(
    id: string,
    payload: Partial<SavePayrollAdjustmentPayload>
  ): Promise<PayrollAdjustment> {
    const { data, error } = await supabase
      .from("payroll_adjustments")
      .update({
        ...payload,
      })
      .eq("id", id)
      .select(`
        *,
        employee:users!payroll_adjustments_user_id_fkey (
          id,
          name,
          email
        ),
        creator:users!payroll_adjustments_created_by_fkey (
          id,
          name,
          email
        ),
        payroll_periods (
          id,
          name
        )
      `)
      .single();

    if (error) throw error;
    return mapAdjustment(data);
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase
      .from("payroll_adjustments")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },
};