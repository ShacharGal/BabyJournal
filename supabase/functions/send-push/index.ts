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

/* ── Base64url helpers ────────────────────────────────────────── */

function base64urlToUint8Array(b64: string): Uint8Array {
  const padding = "=".repeat((4 - (b64.length % 4)) % 4);
  const base64 = (b64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function uint8ArrayToBase64url(arr: Uint8Array): string {
  let binary = "";
  for (const b of arr) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/* ── VAPID JWT ────────────────────────────────────────────────── */

async function createVapidJwt(
  audience: string,
  subject: string,
  privateKeyBase64url: string,
): Promise<string> {
  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = { aud: audience, exp: now + 12 * 3600, sub: subject };

  const enc = new TextEncoder();
  const headerB64 = uint8ArrayToBase64url(enc.encode(JSON.stringify(header)));
  const payloadB64 = uint8ArrayToBase64url(enc.encode(JSON.stringify(payload)));
  const unsigned = `${headerB64}.${payloadB64}`;

  // Import VAPID private key as ECDSA P-256
  const rawKey = base64urlToUint8Array(privateKeyBase64url);
  const key = await crypto.subtle.importKey(
    "pkcs8",
    rawKey,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );

  const sig = new Uint8Array(
    await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      enc.encode(unsigned),
    ),
  );

  return `${unsigned}.${uint8ArrayToBase64url(sig)}`;
}

/* ── Web Push encryption (aes128gcm) ─────────────────────────── */

async function encryptPayload(
  payload: string,
  p256dhBase64url: string,
  authBase64url: string,
): Promise<{ encrypted: Uint8Array; salt: Uint8Array; localPublicKey: Uint8Array }> {
  const enc = new TextEncoder();
  const payloadBytes = enc.encode(payload);
  const clientPubBytes = base64urlToUint8Array(p256dhBase64url);
  const authSecret = base64urlToUint8Array(authBase64url);

  // Generate local ECDH key pair
  const localKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  );

  const localPubRaw = new Uint8Array(
    await crypto.subtle.exportKey("raw", localKeyPair.publicKey),
  );

  // Import client public key
  const clientPubKey = await crypto.subtle.importKey(
    "raw",
    clientPubBytes,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );

  // ECDH shared secret
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: clientPubKey },
      localKeyPair.privateKey,
      256,
    ),
  );

  // Salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // HKDF: auth_info, PRK, then derive IKM, then content encryption key + nonce
  const authInfo = concatBytes(
    enc.encode("WebPush: info\0"),
    clientPubBytes,
    localPubRaw,
  );

  const prkKey = await crypto.subtle.importKey("raw", authSecret, { name: "HKDF" }, false, ["deriveBits"]);
  const ikm = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt: sharedSecret, info: authInfo },
      prkKey,
      256,
    ),
  );

  const ikmKey = await crypto.subtle.importKey("raw", ikm, { name: "HKDF" }, false, ["deriveBits"]);

  const cekBits = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt, info: enc.encode("Content-Encoding: aes128gcm\0") },
      ikmKey,
      128,
    ),
  );

  const nonce = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt, info: enc.encode("Content-Encoding: nonce\0") },
      ikmKey,
      96,
    ),
  );

  // Pad payload (add delimiter 0x02 for last record)
  const padded = concatBytes(payloadBytes, new Uint8Array([2]));

  // AES-128-GCM encrypt
  const aesKey = await crypto.subtle.importKey("raw", cekBits, { name: "AES-GCM" }, false, ["encrypt"]);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, padded),
  );

  // Build aes128gcm header: salt(16) + rs(4) + idlen(1) + keyid(65) + ciphertext
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, padded.length + 16 + 1); // record size
  const idlen = new Uint8Array([65]); // length of localPubRaw

  const encrypted = concatBytes(salt, rs, idlen, localPubRaw, ciphertext);
  return { encrypted, salt, localPublicKey: localPubRaw };
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    result.set(a, offset);
    offset += a.length;
  }
  return result;
}

/* ── Send a single push notification ─────────────────────────── */

async function sendWebPush(
  endpoint: string,
  p256dh: string,
  auth: string,
  payloadJson: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string,
): Promise<{ success: boolean; status: number; gone: boolean }> {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;

  const jwt = await createVapidJwt(audience, vapidSubject, vapidPrivateKey);
  const { encrypted } = await encryptPayload(payloadJson, p256dh, auth);

  const resp = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      Authorization: `vapid t=${jwt}, k=${vapidPublicKey}`,
      TTL: "86400",
      Urgency: "normal",
    },
    body: encrypted,
  });

  console.log(`[SendPush] POST ${endpoint.slice(0, 60)}... → ${resp.status}`);
  return { success: resp.status >= 200 && resp.status < 300, status: resp.status, gone: resp.status === 410 };
}

/* ── Main handler ─────────────────────────────────────────────── */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { babyName, description, postedByUserId, postedByNickname } = await req.json();
    console.log(`[SendPush] New post by ${postedByNickname} about ${babyName}`);

    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:noreply@babyjournal.app";

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.error("[SendPush] VAPID keys not configured");
      return json({ error: "VAPID keys not configured" }, 500);
    }

    // Get all users except the poster
    const { data: users, error: usersErr } = await supabase
      .from("app_users")
      .select("id, nickname, notification_pref")
      .neq("id", postedByUserId)
      .neq("notification_pref", "none");

    if (usersErr) throw usersErr;
    if (!users || users.length === 0) {
      console.log("[SendPush] No users to notify");
      return json({ sent: 0 });
    }

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

    // Get push subscriptions for eligible users
    const userIds = eligibleUsers.map((u) => u.id);
    const { data: subs, error: subsErr } = await supabase
      .from("push_subscriptions")
      .select("*")
      .in("user_id", userIds);

    if (subsErr) throw subsErr;
    if (!subs || subs.length === 0) {
      console.log("[SendPush] No push subscriptions found");
      return json({ sent: 0 });
    }

    // Build user lookup for mention detection
    const userMap = new Map(eligibleUsers.map((u) => [u.id, u]));

    let sent = 0;
    const goneSubs: string[] = [];

    for (const sub of subs) {
      const u = userMap.get(sub.user_id);
      const isMentioned = u?.notification_pref === "mentioned" ||
        (description && new RegExp(`@${u?.nickname?.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?!\\p{L})`, "iu").test(description));

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

      try {
        const result = await sendWebPush(
          sub.endpoint, sub.p256dh, sub.auth,
          payloadJson,
          vapidPublicKey, vapidPrivateKey, vapidSubject,
        );
        if (result.success) sent++;
        if (result.gone) goneSubs.push(sub.id);
      } catch (err) {
        console.error(`[SendPush] Failed for sub ${sub.id}:`, err);
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
