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
    const { action, userId } = body;

    if (!userId) return json({ error: "userId required" }, 400);

    if (action === "subscribe") {
      const { endpoint, p256dh, auth } = body;
      if (!endpoint || !p256dh || !auth) {
        return json({ error: "endpoint, p256dh, and auth required" }, 400);
      }

      const { error } = await supabase
        .from("push_subscriptions")
        .upsert(
          { user_id: userId, endpoint, p256dh, auth },
          { onConflict: "user_id,endpoint" }
        );

      if (error) throw error;
      console.log("[PushSubscribe] Saved subscription for user:", userId);
      return json({ success: true });
    }

    if (action === "unsubscribe") {
      const { endpoint } = body;
      if (!endpoint) return json({ error: "endpoint required" }, 400);

      const { error } = await supabase
        .from("push_subscriptions")
        .delete()
        .eq("user_id", userId)
        .eq("endpoint", endpoint);

      if (error) throw error;
      console.log("[PushSubscribe] Removed subscription for user:", userId);
      return json({ success: true });
    }

    return json({ error: "Invalid action. Use 'subscribe' or 'unsubscribe'" }, 400);
  } catch (err) {
    console.error("[PushSubscribe] Error:", err);
    return json({ error: err.message || "Internal server error" }, 500);
  }
});
