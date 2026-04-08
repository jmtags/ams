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

  if (req.method !== "GET") {
    return jsonResponse({ success: false, error: "Method not allowed" }, 405);
  }

  try {
    await requirePrivilegedUser(req);

    const url = new URL(req.url);
    const runId = url.searchParams.get("run_id");
    const limit = Number(url.searchParams.get("limit") || 20);

    if (runId) {
      const { data: run, error: runError } = await admin
        .from("ai_review_runs")
        .select("*")
        .eq("id", runId)
        .single();

      if (runError) throw runError;

      const { data: findings, error: findingsError } = await admin
        .from("ai_review_findings")
        .select("*")
        .eq("run_id", runId)
        .order("created_at", { ascending: true });

      if (findingsError) throw findingsError;

      return jsonResponse({
        success: true,
        run,
        findings: findings || [],
      });
    }

    const { data, error } = await admin
      .from("ai_review_runs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(Number.isFinite(limit) ? Math.min(limit, 100) : 20);

    if (error) throw error;

    return jsonResponse({
      success: true,
      runs: data || [],
    });
  } catch (error) {
    console.error("get-ai-review-runs error:", error);
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