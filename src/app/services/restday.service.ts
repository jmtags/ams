
import { supabase } from "../lib/supabase";
export type RestDay = {
  id: string;
  user_id: string;
  day_of_week: string;
  effective_from: string;
  effective_to: string | null;
  created_at?: string;
};

export const restDayService = {
  async getUserRestDays(userId: string): Promise<RestDay[]> {
    const { data, error } = await supabase
      .from("user_rest_days")
      .select("*")
      .eq("user_id", userId)
      .order("effective_from", { ascending: false })
      .order("day_of_week", { ascending: true });

    if (error) throw error;
    return (data as RestDay[]) ?? [];
  },

  async addRestDay(payload: {
    user_id: string;
    day_of_week: string;
    effective_from: string;
    effective_to?: string | null;
  }): Promise<void> {
    const { error } = await supabase.from("user_rest_days").insert({
      user_id: payload.user_id,
      day_of_week: payload.day_of_week,
      effective_from: payload.effective_from,
      effective_to: payload.effective_to ?? null,
    });

    if (error) throw error;
  },

  async updateRestDay(
    id: string,
    payload: {
      day_of_week: string;
      effective_from: string;
      effective_to?: string | null;
    }
  ): Promise<void> {
    const { error } = await supabase
      .from("user_rest_days")
      .update({
        day_of_week: payload.day_of_week,
        effective_from: payload.effective_from,
        effective_to: payload.effective_to ?? null,
      })
      .eq("id", id);

    if (error) throw error;
  },

  async deleteRestDay(id: string): Promise<void> {
    const { error } = await supabase
      .from("user_rest_days")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },
};