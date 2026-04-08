import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Method not allowed" }, 405);
  }

  try {
    const caller = await requirePrivilegedUser(req);
    const body = await req.json().catch(() => ({}));

    const finding_id: string = body.finding_id;
    const status: string = body.status;

    const allowed = ["open", "acknowledged", "resolved", "false_positive"];
    if (!finding_id || !status) {
      return jsonResponse(
        { success: false, error: "finding_id and status are required" },
        400,
      );
    }

    if (!allowed.includes(status)) {
      return jsonResponse(
        { success: false, error: "Invalid status" },
        400,
      );
    }

    const { data, error } = await admin
      .from("ai_review_findings")
      .update({
        status,
        reviewed_by: caller.user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", finding_id)
      .select("*")
      .single();

    if (error) throw error;

    return jsonResponse({
      success: true,
      finding: data,
    });
  } catch (error) {
    console.error("update-ai-review-finding-status error:", error);
    return jsonResponse(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});

async function requirePrivilegedUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    throw new Error("Missing Authorization header");
  }

  const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data, error } = await anonClient.auth.getUser();
  if (error || !data.user) {
    throw new Error("Unauthorized");
  }

  const { data: profile, error: profileError } = await admin
    .from("users")
    .select("id, role")
    .eq("id", data.user.id)
    .single();

  if (profileError) {
    throw new Error("Unable to read user profile");
  }

  const role = String(profile.role || "").toLowerCase();
  if (!["admin", "hr", "payroll"].includes(role)) {
    throw new Error("Forbidden: only admin, HR, or payroll can access this function");
  }

  return { user: data.user, profile };
}