import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing Authorization header");
    }

    const { id } = await req.json();
    if (!id) {
      throw new Error("User id is required");
    }

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

    const {
      data: { user: requestingUser },
      error: requesterError,
    } = await supabaseUser.auth.getUser();

    if (requesterError || !requestingUser) {
      throw new Error("Unauthorized");
    }

    if (requestingUser.id === id) {
      throw new Error("You cannot delete your own account while signed in.");
    }

    const { data: requesterProfile, error: requesterProfileError } =
      await supabaseAdmin
        .from("users")
        .select("id, role")
        .eq("id", requestingUser.id)
        .maybeSingle();

    if (requesterProfileError || !requesterProfile) {
      throw new Error("Requester profile not found.");
    }

    if (requesterProfile.role !== "admin") {
      throw new Error("Only admins can delete users.");
    }

    const { error: profileDeleteError } = await supabaseAdmin
      .from("users")
      .delete()
      .eq("id", id);

    if (profileDeleteError) {
      if (profileDeleteError.code === "23503") {
        throw new Error(
          "This user has related records and cannot be deleted safely. Remove or archive their related attendance, leave, payroll, and rest-day records first."
        );
      }

      throw profileDeleteError;
    }

    const { error: authDeleteError } =
      await supabaseAdmin.auth.admin.deleteUser(id);

    if (authDeleteError) {
      throw authDeleteError;
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: corsHeaders,
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message ?? "Unknown error",
      }),
      {
        status: 400,
        headers: corsHeaders,
      }
    );
  }
});
