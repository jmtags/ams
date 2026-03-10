import { supabase } from "../lib/supabase";

export type Location = {
  id: string;
  name: string;
};

export type Shift = {
  id: string;
  name: string;
  location_id: string | null;
  start_time: string;
  end_time: string;
  grace_minutes: number;
  overtime_after_minutes: number;
  is_active: boolean;
  created_at: string;
  locations?: {
    id: string;
    name: string;
  } | null;
};

export type ShiftFormData = {
  name: string;
  location_id: string;
  start_time: string;
  end_time: string;
  grace_minutes: number;
  overtime_after_minutes: number;
  is_active: boolean;
};

export const shiftService = {
  async getLocations(): Promise<Location[]> {
    const { data, error } = await supabase
      .from("locations")
      .select("id, name")
      .order("name", { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async getShifts(): Promise<Shift[]> {
    const { data, error } = await supabase
      .from("shifts")
      .select(`
        id,
        name,
        location_id,
        start_time,
        end_time,
        grace_minutes,
        overtime_after_minutes,
        is_active,
        created_at,
        locations:location_id (
          id,
          name
        )
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data as Shift[]) || [];
  },

  async addShift(form: ShiftFormData) {
    const payload = {
      name: form.name.trim(),
      location_id: form.location_id,
      start_time: form.start_time + ":00",
      end_time: form.end_time + ":00",
      grace_minutes: Number(form.grace_minutes),
      overtime_after_minutes: Number(form.overtime_after_minutes),
      is_active: form.is_active,
    };

    const { data, error } = await supabase
      .from("shifts")
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateShift(id: string, form: ShiftFormData) {
    const payload = {
      name: form.name.trim(),
      location_id: form.location_id,
      start_time: form.start_time + ":00",
      end_time: form.end_time + ":00",
      grace_minutes: Number(form.grace_minutes),
      overtime_after_minutes: Number(form.overtime_after_minutes),
      is_active: form.is_active,
    };

    const { data, error } = await supabase
      .from("shifts")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteShift(id: string) {
    const { error } = await supabase.from("shifts").delete().eq("id", id);
    if (error) throw error;
    return true;
  },

  async toggleShiftStatus(id: string, currentValue: boolean) {
    const { data, error } = await supabase
      .from("shifts")
      .update({ is_active: !currentValue })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};