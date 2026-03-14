import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing Authorization header");
    }

    const body = await req.json();
    const {
      email,
      password,
      name,
      department,
      role = "user",
       shift_id,
      sss = null,
      pagibig = null,
      philhealth = null,
      atm_number = null,
    } = body;

    

    if (!email) throw new Error("Email is required");
    if (!password) throw new Error("Password is required");
    if (!name) throw new Error("Name is required");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      }
    );

    // Check requesting user
    const {
      data: { user: requestingUser },
      error: requesterError,
    } = await supabaseUser.auth.getUser();

    if (requesterError || !requestingUser) {
      throw new Error("Unauthorized");
    }

    // Optional: verify requester is admin from public.users
    const { data: requesterProfile, error: requesterProfileError } =
      await supabaseAdmin
        .from("users")
        .select("id, role")
        .eq("id", requestingUser.id)
        .single();

    if (requesterProfileError || !requesterProfile) {
      throw new Error("Requester profile not found");
    }

    if (requesterProfile.role !== "admin") {
      throw new Error("Only admins can create users");
    }

    // 1. Create auth user
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          name,
        },
      });

    if (authError) throw authError;
    if (!authData.user) throw new Error("User creation failed");

    const userId = authData.user.id;

     // 2. Since trigger already creates public.users row,
    // update that row with the additional fields
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from("users")
      .update({
        name,
        email,
        department: department ?? null,
        role,
        shift_id,
        sss,
        pagibig,
        philhealth,
        atm_number,
      })
      .eq("id", userId)
      .select("*")
      .single();

    if (profileError) {
      throw profileError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: profileData,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message ?? "Unknown error",
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});