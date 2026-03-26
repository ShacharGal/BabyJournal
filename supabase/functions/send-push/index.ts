import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

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

    const { babyName, description, postedByUserId, postedByNickname, isPrivate } = await req.json();
    console.log(`[SendPush] New post by ${postedByNickname} about ${babyName}${isPrivate ? " (private)" : ""}`);

    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:noreply@babyjournal.app";

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.error("[SendPush] VAPID keys not configured");
      return json({ error: "VAPID keys not configured" }, 500);
    }

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    // Get all users except the poster
    let usersQuery = supabase
      .from("app_users")
      .select("id, nickname, notification_pref, permission")
      .neq("id", postedByUserId)
      .neq("notification_pref", "none");

    // Private entries: only notify full-permission users
    if (isPrivate) {
      usersQuery = usersQuery.eq("permission", "full");
    }

    const { data: users, error: usersErr } = await usersQuery;

    if (usersErr) throw usersErr;
    if (!users || users.length === 0) {
      console.log("[SendPush] No users to notify");
      return json({ sent: 0 });
    }

    console.log(`[SendPush] Found ${users.length} potential users to notify`);

    // Filter by mention preference
    const eligibleUsers = users.filter((u) => {
      if (u.notification_pref === "all") return true;
      if (u.notification_pref === "mentioned") {
        if (!description) return false;
        const pattern = new RegExp(`@${u.nickname.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?!\\p{L})`, "iu");
        return pattern.test(description);
      }
      return false;
    });

    if (eligibleUsers.length === 0) {
      console.log("[SendPush] No eligible users after mention filter");
      return json({ sent: 0 });
    }

    console.log(`[SendPush] ${eligibleUsers.length} eligible users after mention filter`);

    // Get push subscriptions for eligible users
    const userIds = eligibleUsers.map((u) => u.id);
    const { data: subs, error: subsErr } = await supabase
      .from("push_subscriptions")
      .select("*")
      .in("user_id", userIds);

    if (subsErr) throw subsErr;
    if (!subs || subs.length === 0) {
      console.log("[SendPush] No push subscriptions found for eligible users");
      return json({ sent: 0 });
    }

    console.log(`[SendPush] Found ${subs.length} push subscriptions`);

    // Build user lookup for mention detection
    const userMap = new Map(eligibleUsers.map((u) => [u.id, u]));

    let sent = 0;
    const goneSubs: string[] = [];

    for (const sub of subs) {
      const u = userMap.get(sub.user_id);
      const isMentioned = u?.notification_pref === "mentioned" ||
        (description && u?.nickname && new RegExp(`@${u.nickname.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?!\\p{L})`, "iu").test(description));

      // Build notification payload — differentiate mention vs general
      const title = isMentioned
        ? `${postedByNickname} mentioned you`
        : `New memory of ${babyName}`;
      const body = isMentioned
        ? `in a memory of ${babyName}: ${(description || "").slice(0, 100)}`
        : description
          ? description.slice(0, 120)
          : `${postedByNickname} added a new memory`;

      const payloadJson = JSON.stringify({ title, body, url: "/" });

      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      };

      try {
        await webpush.sendNotification(pushSubscription, payloadJson);
        console.log(`[SendPush] Sent to ${sub.endpoint.slice(0, 60)}...`);
        sent++;
      } catch (err: any) {
        console.error(`[SendPush] Failed for sub ${sub.id}:`, err?.statusCode, err?.body || err?.message);
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          goneSubs.push(sub.id);
        }
      }
    }

    // Clean up expired subscriptions
    if (goneSubs.length > 0) {
      console.log(`[SendPush] Removing ${goneSubs.length} expired subscriptions`);
      await supabase.from("push_subscriptions").delete().in("id", goneSubs);
    }

    console.log(`[SendPush] Sent ${sent}/${subs.length} notifications`);
    return json({ sent, total: subs.length });
  } catch (err) {
    console.error("[SendPush] Error:", err);
    return json({ error: err.message || "Internal server error" }, 500);
  }
});
