import { supabase } from "../lib/supabase";

export type UserRole = "admin" | "user";

export type User = {
  id: string;
  name: string;
  email: string;
  department: string | null;
  role: UserRole;
  sss?: string | null;
  pagibig?: string | null;
  philhealth?: string | null;
  atm_number?: string | null;
  created_at?: string;
};

type UpdateUserProfilePayload = {
  name: string;
  department?: string | null;
  role?: UserRole;
  sss?: string | null;
  pagibig?: string | null;
  philhealth?: string | null;
  atm_number?: string | null;
};

type AdminUpdateUserPayload = {
  id: string;
  name: string;
  email: string;
  department?: string | null;
  role?: UserRole;
  sss?: string | null;
  pagibig?: string | null;
  philhealth?: string | null;
  atm_number?: string | null;
  password?: string;
  shift_id?: string | null;
};

type CreateUserByAdminPayload = {
  email: string;
  password: string;
  name: string;
  department?: string | null;
  role?: UserRole;
  sss?: string | null;
  pagibig?: string | null;
  philhealth?: string | null;
  atm_number?: string | null;
  shift_id?: string | null;
};


const cleanPayload = <T extends Record<string, any>>(payload: T): Partial<T> => {
  return Object.fromEntries(
    Object.entries(payload).filter(([_, value]) => value !== undefined)
  ) as Partial<T>;
};

export const userService = {
  // ===============================
  // GET ALL USERS (Admin)
  // ===============================
  getUsers: async (): Promise<User[]> => {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []) as User[];
  },

  // ===============================
  // UPDATE PROFILE (User Page)
  // Only updates public.users profile fields
  // ===============================
  updateUserProfile: async (
    id: string,
    payload: {
      name: string;
      sss?: string | null;
      pagibig?: string | null;
      philhealth?: string | null;
      atm_number?: string | null;
    }
  ): Promise<User> => {
    const clean = cleanPayload(payload);

    const { data, error } = await supabase
      .from("users")
      .update(clean)
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;
    return data as User;
  },

  // ===============================
  // ADMIN UPDATE USER
  // Updates:
  // 1) public.users profile fields directly
  // 2) auth email/password via Edge Function if needed
  // ===============================
updateUserByAdmin: async (payload: AdminUpdateUserPayload): Promise<User> => {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw new Error(sessionError.message);
  }

  if (!session) {
    throw new Error("Not authenticated. Please login again.");
  }

  const { data, error } = await supabase.functions.invoke("admin-update-user", {
    body: payload,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  console.log("admin-update-user response:", { data, error });

  if (error) {
    throw new Error(error.message || "Failed to update user");
  }

  if (!data?.success) {
    throw new Error(data?.error || "Failed to update user");
  }

  return data.user as User;
},

  // ===============================
  // DELETE USER
  // Only deletes from public.users
  // If you want to delete auth user too,
  // do it via Edge Function separately
  // ===============================
  deleteUser: async (id: string): Promise<void> => {
    const { error } = await supabase.from("users").delete().eq("id", id);

    if (error) throw error;
  },

  // ===============================
  // CREATE USER (Admin via Edge Function)
  // ===============================
createUserByAdmin: async (
  payload: CreateUserByAdminPayload
): Promise<any> => {
  const { data, error } = await supabase.functions.invoke("create-user", {
    body: payload,
  });

  if (error) {
    console.error("create-user Edge Function Error:", error);
    throw new Error(error.message || "Failed to create user");
  }

  if (!data?.success) {
    throw new Error(data?.error || "Failed to create user");
  }

  return data;
},
};