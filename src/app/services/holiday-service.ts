import { supabase } from "../lib/supabase";
export type Holiday = {
  id: string;
  name: string;
  holiday_date: string;
  type: string;
  description: string | null;
  is_paid: boolean;
  location_id: string | null;
  created_at: string;
};

export type HolidayPayload = {
  name: string;
  holiday_date: string;
  type: string;
  description?: string | null;
  is_paid: boolean;
  location_id?: string | null;
};

export type Location = {
  id: string;
  name: string;
};

export const holidayService = {
  async getAll(): Promise<Holiday[]> {
    const { data, error } = await supabase
      .from("holidays")
      .select("*")
      .order("holiday_date", { ascending: true });

    if (error) {
      throw error;
    }

    return (data as Holiday[]) || [];
  },

  async getLocations(): Promise<Location[]> {
    const { data, error } = await supabase
      .from("locations")
      .select("id, name")
      .order("name", { ascending: true });

    if (error) {
      throw error;
    }

    return (data as Location[]) || [];
  },

  async create(payload: HolidayPayload): Promise<Holiday> {
    const { data, error } = await supabase
      .from("holidays")
      .insert({
        name: payload.name,
        holiday_date: payload.holiday_date,
        type: payload.type,
        description: payload.description ?? null,
        is_paid: payload.is_paid,
        location_id: payload.location_id ?? null,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data as Holiday;
  },

  async update(id: string, payload: HolidayPayload): Promise<Holiday> {
    const { data, error } = await supabase
      .from("holidays")
      .update({
        name: payload.name,
        holiday_date: payload.holiday_date,
        type: payload.type,
        description: payload.description ?? null,
        is_paid: payload.is_paid,
        location_id: payload.location_id ?? null,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data as Holiday;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("holidays").delete().eq("id", id);

    if (error) {
      throw error;
    }
  },
};