import { supabase } from "../lib/supabase";

export type User = {
  id: string
  name: string
  email: string
  department: string | null
  role: 'admin' | 'user'
  sss?: string | null
  pagibig?: string | null
  philhealth?: string | null
  atm_number?: string | null
  created_at?: string
}

export const userService = {
  // ===============================
  // GET ALL USERS (Admin)
  // ===============================
  getUsers: async () => {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
  },

  // ===============================
  // UPDATE PROFILE (User Page)
  // ===============================
  updateUserProfile: async (
    id: string,
    payload: {
      name: string;
      sss?: string;
      pagibig?: string;
      philhealth?: string;
      atm_number?: string;
    }
  ) => {
    const { data, error } = await supabase
      .from("users")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // ===============================
  // ADMIN UPDATE USER
  // ===============================
 updateUserByAdmin: async (
  id: string,
  payload: {
    name: string
    email: string
    department?: string
    role?: 'admin' | 'user'
    sss?: string
    pagibig?: string
    philhealth?: string
    atm_number?: string
  }
) => {
  const { data, error } = await supabase
    .from("users")
    .update(payload)
    .eq("id", id)
    .select();

  if (error) throw error;
  return data;
},
  // ===============================
  // DELETE USER
  // ===============================
  deleteUser: async (id: string) => {
    const { error } = await supabase
      .from("users")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },

  // ===============================
  // CREATE USER (Admin via Edge Function)
  // ===============================
 // ===============================
// CREATE USER (Admin via Edge Function)
// ===============================
createUserByAdmin: async (payload: {
  email: string
  password: string
  name: string
  department?: string
  role?: 'admin' | 'user'
  sss?: string
  pagibig?: string
  philhealth?: string
  atm_number?: string
}) => {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Error("Not authenticated");
  }

  const { data, error } = await supabase.functions.invoke("create-user", {
    body: payload,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (error) {
    console.error("Edge Function Error:", error);
    throw error;
  }

  return data;
},
};