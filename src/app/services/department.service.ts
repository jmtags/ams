import { supabase } from "../lib/supabase";

export const departmentService = {
  // ✅ GET ALL
  getAllDepartments: async () => {
    const { data, error } = await supabase
      .from("departments")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching departments:", error);
      throw error;
    }

    return data ?? [];
  },

  // ✅ CREATE
  createDepartment: async (payload: any) => {
    const { data, error } = await supabase
      .from("departments")
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error("Error creating department:", error);
      throw error;
    }

    return data;
  },

  // ✅ UPDATE
  updateDepartment: async (id: string, payload: any) => {
    const { data, error } = await supabase
      .from("departments")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating department:", error);
      throw error;
    }

    return data;
  },

  // ✅ DELETE
  deleteDepartment: async (id: string) => {
    const { error } = await supabase
      .from("departments")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting department:", error);
      throw error;
    }

    return true;
  },
};
