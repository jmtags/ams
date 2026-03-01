import { supabase } from "../lib/supabase";

export const locationService = {
  // ✅ GET ALL LOCATIONS
  getAllLocations: async () => {
    const { data, error } = await supabase
      .from("locations")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching locations:", error);
      throw error;
    }

    return data ?? [];
  },

  // ✅ CREATE LOCATION
  createLocation: async (payload: any) => {
    const { data, error } = await supabase
      .from("locations")
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error("Error creating location:", error);
      throw error;
    }

    return data;
  },

  // ✅ UPDATE LOCATION
  updateLocation: async (id: string, payload: any) => {
    const { data, error } = await supabase
      .from("locations")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating location:", error);
      throw error;
    }

    return data;
  },

  // ✅ DELETE LOCATION
  deleteLocation: async (id: string) => {
    const { error } = await supabase
      .from("locations")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting location:", error);
      throw error;
    }

    return true;
  },
};
