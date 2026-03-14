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
    const body = await req.json();
    const {
      id,
      name,
      email,
      password,
      department,
      role,
      shift_id,
      sss,
      pagibig,
      philhealth,
      atm_number,
    } = body;

    if (!id) throw new Error("User id is required");
    if (!name) throw new Error("Name is required");
    if (!email) throw new Error("Email is required");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: updatedProfile, error: profileError } = await supabaseAdmin
      .from("users")
      .update({
        name,
        email,
        department: department ?? null,
        role: role ?? "user",
        shift_id: shift_id ?? null,
        sss: sss ?? null,
        pagibig: pagibig ?? null,
        philhealth: philhealth ?? null,
        atm_number: atm_number ?? null,
      })
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (profileError) throw profileError;
    if (!updatedProfile) throw new Error("User profile not found.");

    if (email || password) {
      const authUpdatePayload: Record<string, string> = {};
      if (email) authUpdatePayload.email = email;
      if (password) authUpdatePayload.password = password;

      const { error: authUpdateError } =
        await supabaseAdmin.auth.admin.updateUserById(id, authUpdatePayload);

      if (authUpdateError) throw authUpdateError;
    }

    return new Response(
      JSON.stringify({ success: true, user: updatedProfile }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message ?? "Unknown error" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});