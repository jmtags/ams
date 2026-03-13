import { supabase } from "../lib/supabase";

export type PayrollPeriodStatus =
  | "draft"
  | "processing"
  | "processed"
  | "finalized"
  | "released";

export type PayrollPeriod = {
  id: string;
  name: string;
  date_from: string;
  date_to: string;
  pay_date: string | null;
  status: PayrollPeriodStatus;
  created_at?: string;
  updated_at?: string;
};

export type SavePayrollPeriodPayload = {
  name: string;
  date_from: string;
  date_to: string;
  pay_date?: string | null;
  status?: PayrollPeriodStatus;
};

export const payrollPeriodService = {
  async getAll(): Promise<PayrollPeriod[]> {
    const { data, error } = await supabase
      .from("payroll_periods")
      .select("*")
      .order("date_from", { ascending: false });

    if (error) throw error;
    return (data ?? []) as PayrollPeriod[];
  },

  async getById(id: string): Promise<PayrollPeriod | null> {
    const { data, error } = await supabase
      .from("payroll_periods")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    return data as PayrollPeriod | null;
  },

  async create(payload: SavePayrollPeriodPayload): Promise<PayrollPeriod> {
    const { data, error } = await supabase
      .from("payroll_periods")
      .insert({
        name: payload.name,
        date_from: payload.date_from,
        date_to: payload.date_to,
        pay_date: payload.pay_date ?? null,
        status: payload.status ?? "draft",
      })
      .select("*")
      .single();

    if (error) throw error;
    return data as PayrollPeriod;
  },

  async update(id: string, payload: Partial<SavePayrollPeriodPayload>): Promise<PayrollPeriod> {
    const { data, error } = await supabase
      .from("payroll_periods")
      .update({
        ...payload,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;
    return data as PayrollPeriod;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase
      .from("payroll_periods")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },
};