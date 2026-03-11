import { supabase } from "../lib/supabase";

export interface LeaveType {
  id: string;
  code: string;
  name: string;
  description: string | null;
  requires_attachment: boolean;
  is_active: boolean;
  created_at: string;
}

export interface LeaveTypePayload {
  code: string;
  name: string;
  description?: string | null;
  requires_attachment?: boolean;
  is_active?: boolean;
}

const mapLeaveType = (record: any): LeaveType => ({
  id: record.id,
  code: record.code ?? "",
  name: record.name ?? "",
  description: record.description ?? null,
  requires_attachment: Boolean(record.requires_attachment),
  is_active: Boolean(record.is_active),
  created_at: record.created_at,
});

export const leaveTypeService = {
  async getAll(search?: string): Promise<LeaveType[]> {
    let query = supabase
      .from("leave_types")
      .select("*")
      .order("created_at", { ascending: false });

    if (search && search.trim()) {
      const keyword = search.trim();
      query = query.or(
        `code.ilike.%${keyword}%,name.ilike.%${keyword}%,description.ilike.%${keyword}%`
      );
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(error.message || "Failed to fetch leave types.");
    }

    return (data ?? []).map(mapLeaveType);
  },

  async getById(id: string): Promise<LeaveType | null> {
    const { data, error } = await supabase
      .from("leave_types")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw new Error(error.message || "Failed to fetch leave type.");
    }

    return mapLeaveType(data);
  },

  async create(payload: LeaveTypePayload): Promise<LeaveType> {
    const code = payload.code.trim().toUpperCase();
    const name = payload.name.trim();

    if (!code) throw new Error("Leave type code is required.");
    if (!name) throw new Error("Leave type name is required.");

    const { data, error } = await supabase
      .from("leave_types")
      .insert([
        {
          code,
          name,
          description: payload.description?.trim() || null,
          requires_attachment: payload.requires_attachment ?? false,
          is_active: payload.is_active ?? true,
        },
      ])
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new Error("A leave type with the same code already exists.");
      }
      throw new Error(error.message || "Failed to create leave type.");
    }

    return mapLeaveType(data);
  },

  async update(id: string, payload: LeaveTypePayload): Promise<LeaveType> {
    const code = payload.code.trim().toUpperCase();
    const name = payload.name.trim();

    if (!code) throw new Error("Leave type code is required.");
    if (!name) throw new Error("Leave type name is required.");

    const { data, error } = await supabase
      .from("leave_types")
      .update({
        code,
        name,
        description: payload.description?.trim() || null,
        requires_attachment: payload.requires_attachment ?? false,
        is_active: payload.is_active ?? true,
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new Error("A leave type with the same code already exists.");
      }
      throw new Error(error.message || "Failed to update leave type.");
    }

    return mapLeaveType(data);
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("leave_types").delete().eq("id", id);

    if (error) {
      throw new Error(
        error.message ||
          "Failed to delete leave type. It may already be used by leave balances or leave requests."
      );
    }
  },
};