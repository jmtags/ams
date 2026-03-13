import { supabase } from "../lib/supabase";

export type UserRole = "admin" | "user";

export type User = {
  id: string;
  name: string;
  email: string;
  department: string | null;
  role: UserRole;
  shift_id?: string | null;
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

const getAccessTokenOrThrow = async (): Promise<string> => {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw new Error(sessionError.message || "Failed to get session.");
  }

  if (session?.access_token) {
    return session.access_token;
  }

  const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();

  if (refreshError) {
    throw new Error(refreshError.message || "Session expired. Please log in again.");
  }

  const refreshedToken = refreshData.session?.access_token;

  if (!refreshedToken) {
    throw new Error("No active session found. Please log in again.");
  }

  return refreshedToken;
};

const isJwtLikeError = (message?: string) => {
  const text = (message || "").toLowerCase();

  return (
    text.includes("jwt") ||
    text.includes("not authenticated") ||
    text.includes("unauthorized") ||
    text.includes("invalid token") ||
    text.includes("auth")
  );
};

const invokeAdminUpdateUser = async (
  payload: AdminUpdateUserPayload,
  accessToken: string
) => {
  return supabase.functions.invoke("admin-update-user", {
    body: payload,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
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
  // 2) auth email/password via Edge Function
  // ===============================
updateUserByAdmin: async (payload: AdminUpdateUserPayload): Promise<User> => {
  const { data, error } = await supabase
    .from("users")
    .update({
      name: payload.name,
      department: payload.department ?? null,
      role: payload.role ?? "user",
      shift_id: payload.shift_id ?? null,
      sss: payload.sss ?? null,
      pagibig: payload.pagibig ?? null,
      philhealth: payload.philhealth ?? null,
      atm_number: payload.atm_number ?? null,
    })
    .eq("id", payload.id)
    .select("*")
    .single();

  if (error) throw new Error(error.message || "Failed to update user");
  return data as User;
},

  // ===============================
  // DELETE USER
  // Only deletes from public.users
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
    const accessToken = await getAccessTokenOrThrow();

    const { data, error } = await supabase.functions.invoke("create-user", {
      body: payload,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
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