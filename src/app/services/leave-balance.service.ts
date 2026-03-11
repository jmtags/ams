import { supabase } from "../lib/supabase";

export interface LeaveBalance {
  id: string;
  user_id: string;
  leave_type_id: string;
  year: number;
  entitled: number;
  used: number;
  pending: number;
  created_at: string;
  updated_at: string | null;
  user_name: string;
  user_email: string | null;
  leave_type_code: string;
  leave_type_name: string;
}

export interface LeaveBalancePayload {
  user_id: string;
  leave_type_id: string;
  year: number;
  entitled: number;
  used?: number;
  pending?: number;
}

const mapLeaveBalance = (record: any): LeaveBalance => ({
  id: record.id,
  user_id: record.user_id,
  leave_type_id: record.leave_type_id,
  year: Number(record.year ?? 0),
  entitled: Number(record.entitled ?? 0),
  used: Number(record.used ?? 0),
  pending: Number(record.pending ?? 0),
  created_at: record.created_at,
  updated_at: record.updated_at ?? null,
  user_name: record.users?.name ?? "",
  user_email: record.users?.email ?? null,
  leave_type_code: record.leave_types?.code ?? "",
  leave_type_name: record.leave_types?.name ?? "",
});

export const leaveBalanceService = {
async getAll(search?: string): Promise<LeaveBalance[]> {
  let query = supabase
    .from("leave_balances")
    .select(`
      *,
      users (
        id,
        name,
        email
      ),
      leave_types (
        id,
        code,
        name
      )
    `)
    .order("created_at", { ascending: false });

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message || "Failed to fetch leave balances.");
  }

  let results = (data ?? []).map(mapLeaveBalance);

  if (search && search.trim()) {
    const keyword = search.trim().toLowerCase();

    results = results.filter((item) => {
      return (
        String(item.year).includes(keyword) ||
        (item.user_name ?? "").toLowerCase().includes(keyword) ||
        (item.user_email ?? "").toLowerCase().includes(keyword) ||
        (item.leave_type_code ?? "").toLowerCase().includes(keyword) ||
        (item.leave_type_name ?? "").toLowerCase().includes(keyword)
      );
    });
  }

  return results;
},
async getByUser(userId: string, year?: number) {
  let query = supabase
    .from("leave_balances")
    .select(`
      *,
      leave_types (
        id,
        code,
        name
      )
    `)
    .eq("user_id", userId)
    .order("year", { ascending: false });

  if (year) {
    query = query.eq("year", year);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message || "Failed to load leave balances.");
  }

  return (data ?? []).map((row: any) => ({
    id: row.id,
    user_id: row.user_id,
    leave_type_id: row.leave_type_id,
    year: Number(row.year ?? 0),
    entitled: Number(row.entitled ?? 0),
    used: Number(row.used ?? 0),
    pending: Number(row.pending ?? 0),
    created_at: row.created_at,
    updated_at: row.updated_at ?? null,
    leave_type_code: row.leave_types?.code ?? "",
    leave_type_name: row.leave_types?.name ?? "",
  }));
},

  async create(payload: LeaveBalancePayload): Promise<LeaveBalance> {
    if (!payload.user_id) throw new Error("User is required.");
    if (!payload.leave_type_id) throw new Error("Leave type is required.");
    if (!payload.year) throw new Error("Year is required.");

    const { data, error } = await supabase
      .from("leave_balances")
      .insert([
        {
          user_id: payload.user_id,
          leave_type_id: payload.leave_type_id,
          year: payload.year,
          entitled: payload.entitled,
          used: payload.used ?? 0,
          pending: payload.pending ?? 0,
        },
      ])
      .select(`
        *,
        users (
          id,
          name,
          email
        ),
        leave_types (
          id,
          code,
          name
        )
      `)
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new Error("This user already has a leave balance for this leave type and year.");
      }
      throw new Error(error.message || "Failed to create leave balance.");
    }

    return mapLeaveBalance(data);
  },

  async update(id: string, payload: LeaveBalancePayload): Promise<LeaveBalance> {
    if (!payload.user_id) throw new Error("User is required.");
    if (!payload.leave_type_id) throw new Error("Leave type is required.");
    if (!payload.year) throw new Error("Year is required.");

    const { data, error } = await supabase
      .from("leave_balances")
      .update({
        user_id: payload.user_id,
        leave_type_id: payload.leave_type_id,
        year: payload.year,
        entitled: payload.entitled,
        used: payload.used ?? 0,
        pending: payload.pending ?? 0,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select(`
        *,
        users (
          id,
          name,
          email
        ),
        leave_types (
          id,
          code,
          name
        )
      `)
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new Error("This user already has a leave balance for this leave type and year.");
      }
      throw new Error(error.message || "Failed to update leave balance.");
    }

    return mapLeaveBalance(data);
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase
      .from("leave_balances")
      .delete()
      .eq("id", id);

    if (error) {
      throw new Error(error.message || "Failed to delete leave balance.");
    }
  },
};