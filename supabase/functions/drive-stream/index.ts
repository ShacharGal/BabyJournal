import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, range",
  "Access-Control-Expose-Headers": "content-range, content-length, accept-ranges, content-type",
};

interface GoogleToken {
  id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
}

async function getValidAccessToken(supabase: any): Promise<string> {
  const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
  const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");

  const { data, error } = await supabase
    .from("google_tokens")
    .select("*")
    .limit(1)
    .single();

  if (error || !data) {
    throw new Error("No Google tokens found. Please connect Google Drive first.");
  }

  const tokenRow = data as GoogleToken;

  const expiresAt = new Date(tokenRow.expires_at);
  const now = new Date();
  const bufferMs = 5 * 60 * 1000;

  if (expiresAt.getTime() - now.getTime() < bufferMs) {
    const refreshResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID!,
        client_secret: GOOGLE_CLIENT_SECRET!,
        refresh_token: tokenRow.refresh_token,
        grant_type: "refresh_token",
      }),
    });

    const refreshData = await refreshResponse.json();

    if (refreshData.error) {
      throw new Error("Failed to refresh token: " + refreshData.error);
    }

    const newExpiresAt = new Date(Date.now() + refreshData.expires_in * 1000).toISOString();
    await supabase
      .from("google_tokens")
      .update({
        access_token: refreshData.access_token,
        expires_at: newExpiresAt,
      })
      .eq("id", tokenRow.id);

    return refreshData.access_token;
  }

  return tokenRow.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const fileId = url.searchParams.get("fileId");

    if (!fileId) {
      return new Response(JSON.stringify({ error: "Missing fileId parameter" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // No JWT verification — deployed with --no-verify-jwt
    // Security: requires knowing a valid Google Drive file ID
    const accessToken = await getValidAccessToken(supabase);

    // Build headers for the Google Drive request, forwarding Range if present
    const driveHeaders: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
    };

    const rangeHeader = req.headers.get("Range");
    if (rangeHeader) {
      driveHeaders["Range"] = rangeHeader;
    }

    // Fetch from Google Drive with streaming
    const driveRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      { headers: driveHeaders }
    );

    if (!driveRes.ok && driveRes.status !== 206) {
      const errText = await driveRes.text();
      console.error("[drive-stream] Drive error:", driveRes.status, errText);
      return new Response(JSON.stringify({ error: `Drive API error: ${driveRes.status}` }), {
        status: driveRes.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Forward the response headers we care about
    const responseHeaders: Record<string, string> = {
      ...corsHeaders,
    };

    const contentType = driveRes.headers.get("Content-Type");
    if (contentType) responseHeaders["Content-Type"] = contentType;

    const contentLength = driveRes.headers.get("Content-Length");
    if (contentLength) responseHeaders["Content-Length"] = contentLength;

    const contentRange = driveRes.headers.get("Content-Range");
    if (contentRange) responseHeaders["Content-Range"] = contentRange;

    responseHeaders["Accept-Ranges"] = "bytes";

    // Stream the body through directly — no buffering
    return new Response(driveRes.body, {
      status: driveRes.status,
      headers: responseHeaders,
    });
  } catch (e: any) {
    console.error("[drive-stream] Error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
