import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getAccessToken(supabase: any): Promise<string> {
  const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
  const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

  const { data: tokenRow, error } = await supabase
    .from("google_tokens")
    .select("*")
    .limit(1)
    .single();

  if (error || !tokenRow) throw new Error("No Google tokens found. Connect Google first.");

  // Check if token is still valid (with 60s buffer)
  const expiresAt = new Date(tokenRow.expires_at).getTime();
  if (Date.now() < expiresAt - 60_000) {
    return tokenRow.access_token;
  }

  // Refresh
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: tokenRow.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  const data = await res.json();
  if (data.error) throw new Error(data.error_description || data.error);

  const newExpires = new Date(Date.now() + data.expires_in * 1000).toISOString();
  await supabase
    .from("google_tokens")
    .update({ access_token: data.access_token, expires_at: newExpires })
    .eq("id", tokenRow.id);

  return data.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pageToken, pageSize } = await req.json();

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const accessToken = await getAccessToken(supabase);

    // List media items from Google Photos
    const url = new URL("https://photoslibrary.googleapis.com/v1/mediaItems");
    url.searchParams.set("pageSize", String(pageSize || 30));
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const photosRes = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const photosData = await photosRes.json();

    if (photosData.error) {
      return new Response(
        JSON.stringify({ error: photosData.error.message }),
        { status: photosData.error.code || 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Map to a simpler shape for the frontend
    const items = (photosData.mediaItems || []).map((item: any) => ({
      id: item.id,
      baseUrl: item.baseUrl,
      filename: item.filename,
      mimeType: item.mimeType,
      width: Number(item.mediaMetadata?.width),
      height: Number(item.mediaMetadata?.height),
      creationTime: item.mediaMetadata?.creationTime,
    }));

    return new Response(
      JSON.stringify({ items, nextPageToken: photosData.nextPageToken || null }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    console.error("photos-list error:", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
