import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  try {
    const body = await req.json()

    const {
      email,
      password,
      name,
      department,
      role,
      sss,
      pagibig,
      philhealth,
      atm_number,
    } = body

    // IMPORTANT: service role key (admin permissions)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    // 1️⃣ Create auth user
    const { data: authUser, error: authError } =
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })

    if (authError) throw authError

    const userId = authUser.user.id

    // 2️⃣ Insert into users table
    const { error: dbError } = await supabase
      .from("users")
      .insert({
        id: userId,
        email,
        name,
        department,
        role: role || "user",
        sss,
        pagibig,
        philhealth,
        atm_number,
      })

    if (dbError) throw dbError

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { "Content-Type": "application/json" } }
    )

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400 }
    )
  }
})