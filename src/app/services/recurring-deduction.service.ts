import { supabase } from "../lib/supabase";

export type RecurringDeduction = {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  deduction_type: "fixed" | "percentage";
  frequency:
    | "every_payroll"
    | "monthly_first_half"
    | "monthly_second_half"
    | "one_time";
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  notes: string | null;
  created_at?: string;
  updated_at?: string;

  user_name?: string;
  user_email?: string | null;
};

export type SaveRecurringDeductionPayload = {
  user_id: string;
  name: string;
  amount: number;
  deduction_type?: "fixed" | "percentage";
  frequency?:
    | "every_payroll"
    | "monthly_first_half"
    | "monthly_second_half"
    | "one_time";
  start_date: string;
  end_date?: string | null;
  is_active?: boolean;
  notes?: string | null;
};

const mapRecurringDeduction = (row: any): RecurringDeduction => ({
  id: row.id,
  user_id: row.user_id,
  name: row.name,
  amount: Number(row.amount ?? 0),
  deduction_type: row.deduction_type ?? "fixed",
  frequency: row.frequency ?? "every_payroll",
  start_date: row.start_date,
  end_date: row.end_date ?? null,
  is_active: Boolean(row.is_active),
  notes: row.notes ?? null,
  created_at: row.created_at,
  updated_at: row.updated_at,
  user_name: row.users?.name ?? "",
  user_email: row.users?.email ?? null,
});

export const recurringDeductionService = {
  async getAll(): Promise<RecurringDeduction[]> {
    const { data, error } = await supabase
      .from("employee_recurring_deductions")
      .select(`
        *,
        users (
          id,
          name,
          email
        )
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []).map(mapRecurringDeduction);
  },

  async getByUser(userId: string): Promise<RecurringDeduction[]> {
    const { data, error } = await supabase
      .from("employee_recurring_deductions")
      .select(`
        *,
        users (
          id,
          name,
          email
        )
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []).map(mapRecurringDeduction);
  },

  async create(
    payload: SaveRecurringDeductionPayload
  ): Promise<RecurringDeduction> {
    const { data, error } = await supabase
      .from("employee_recurring_deductions")
      .insert({
        user_id: payload.user_id,
        name: payload.name,
        amount: payload.amount,
        deduction_type: payload.deduction_type ?? "fixed",
        frequency: payload.frequency ?? "every_payroll",
        start_date: payload.start_date,
        end_date: payload.end_date ?? null,
        is_active: payload.is_active ?? true,
        notes: payload.notes ?? null,
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
    return mapRecurringDeduction(data);
  },

  async update(
    id: string,
    payload: Partial<SaveRecurringDeductionPayload>
  ): Promise<RecurringDeduction> {
    const { data, error } = await supabase
      .from("employee_recurring_deductions")
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
    return mapRecurringDeduction(data);
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase
      .from("employee_recurring_deductions")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },
};