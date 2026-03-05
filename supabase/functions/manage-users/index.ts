import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const { action, callerId } = body;

    // Verify caller has full permission
    const { data: caller } = await supabase
      .from("app_users")
      .select("permission")
      .eq("id", callerId)
      .single();

    if (!caller || caller.permission !== "full") {
      return json({ error: "Unauthorized" }, 403);
    }

    if (action === "list") {
      const { data, error } = await supabase
        .from("app_users")
        .select("id, nickname, permission, created_at")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return json({ users: data });
    }

    if (action === "create") {
      const { nickname, password, permission } = body;
      if (!nickname || !password) return json({ error: "Nickname and password required" }, 400);
      const { data, error } = await supabase
        .from("app_users")
        .insert({ nickname, password, permission: permission || "view_only" })
        .select("id, nickname, permission, created_at")
        .single();
      if (error) throw error;
      return json({ user: data });
    }

    if (action === "update") {
      const { userId, nickname, password, permission } = body;
      if (!userId) return json({ error: "userId required" }, 400);
      const updates: Record<string, string> = {};
      if (nickname) updates.nickname = nickname;
      if (password) updates.password = password;
      if (permission) updates.permission = permission;
      const { data, error } = await supabase
        .from("app_users")
        .update(updates)
        .eq("id", userId)
        .select("id, nickname, permission, created_at")
        .single();
      if (error) throw error;
      return json({ user: data });
    }

    if (action === "delete") {
      const { userId } = body;
      if (!userId) return json({ error: "userId required" }, 400);
      if (userId === callerId) return json({ error: "Cannot delete yourself" }, 400);
      const { error } = await supabase.from("app_users").delete().eq("id", userId);
      if (error) throw error;
      return json({ success: true });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (err) {
    console.error("Error:", err);
    return json({ error: err.message || "Internal server error" }, 500);
  }
});
