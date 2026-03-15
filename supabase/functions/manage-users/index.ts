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

    // Self-service actions (any user can do these for themselves)
    if (action === "get-my-pref") {
      if (!callerId) return json({ error: "callerId required" }, 400);
      const { data, error } = await supabase
        .from("app_users")
        .select("notification_pref")
        .eq("id", callerId)
        .single();
      if (error) throw error;
      return json({ notification_pref: data?.notification_pref || "all" });
    }

    if (action === "update-my-pref") {
      const { notification_pref } = body;
      if (!callerId) return json({ error: "callerId required" }, 400);
      if (!["all", "mentioned", "none"].includes(notification_pref)) {
        return json({ error: "Invalid notification_pref" }, 400);
      }
      const { error } = await supabase
        .from("app_users")
        .update({ notification_pref })
        .eq("id", callerId);
      if (error) throw error;
      return json({ success: true, notification_pref });
    }

    // Verify caller has full permission for admin actions
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
        .select("id, nickname, permission, notification_pref, created_at")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return json({ users: data });
    }

    if (action === "create") {
      const { nickname, password, permission, notification_pref } = body;
      if (!nickname || !password) return json({ error: "Nickname and password required" }, 400);
      const { data, error } = await supabase
        .from("app_users")
        .insert({ nickname, password, permission: permission || "view_only", notification_pref: notification_pref || "all" })
        .select("id, nickname, permission, notification_pref, created_at")
        .single();
      if (error) throw error;
      return json({ user: data });
    }

    if (action === "update") {
      const { userId, nickname, password, permission, notification_pref } = body;
      if (!userId) return json({ error: "userId required" }, 400);
      const updates: Record<string, string> = {};
      if (nickname) updates.nickname = nickname;
      if (password) updates.password = password;
      if (permission) updates.permission = permission;
      if (notification_pref) updates.notification_pref = notification_pref;
      const { data, error } = await supabase
        .from("app_users")
        .update(updates)
        .eq("id", userId)
        .select("id, nickname, permission, notification_pref, created_at")
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
