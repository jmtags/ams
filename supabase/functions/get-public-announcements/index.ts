import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from("announcements")
      .select(
        "id, title, message, image_url, severity, is_active, starts_at, ends_at, created_at, updated_at"
      )
      .eq("is_active", true)
      .or(`starts_at.is.null,starts_at.lte.${now}`)
      .or(`ends_at.is.null,ends_at.gte.${now}`)
      .order("starts_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (error) throw error;

    const announcements = (data ?? []).map((announcement) => ({
      ...announcement,
      image_url: announcement.image_url || null,
    }));

    const { data: policyDocuments, error: policyError } = await supabaseAdmin
      .from("policy_documents")
      .select(
        "id, title, description, category, file_url, file_name, file_size, is_active, created_at, updated_at"
      )
      .eq("is_active", true)
      .order("updated_at", { ascending: false });

    if (policyError) {
      console.error("Failed to load policy documents:", policyError.message);
    }

    return new Response(
      JSON.stringify({
        announcements,
        policy_documents: policyError ? [] : policyDocuments ?? [],
      }),
      {
        headers: {
          ...corsHeaders,
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        announcements: [],
        policy_documents: [],
        error: err.message ?? "Failed to load announcements.",
      }),
      { status: 400, headers: corsHeaders }
    );
  }
});
