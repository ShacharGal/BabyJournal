import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GoogleToken {
  id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
}

async function getValidAccessToken(supabase: SupabaseClient): Promise<string> {
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

  // Check if token is expired (with 5 min buffer)
  const expiresAt = new Date(tokenRow.expires_at);
  const now = new Date();
  const bufferMs = 5 * 60 * 1000;

  if (expiresAt.getTime() - now.getTime() < bufferMs) {
    // Refresh the token
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

    // Update stored token
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
    const body = await req.json();

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Action: return a valid access token (bypasses RLS)
    if (body.action === "get-token") {
      const accessToken = await getValidAccessToken(supabase);
      return new Response(
        JSON.stringify({ accessToken }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { fileName, mimeType, fileContent, folderId } = body;

    if (!fileName || !mimeType || !fileContent || !folderId) {
      return new Response(
        JSON.stringify({ error: "fileName, mimeType, fileContent, and folderId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const accessToken = await getValidAccessToken(supabase);

    // Convert base64 to Uint8Array
    const binaryContent = Uint8Array.from(atob(fileContent), c => c.charCodeAt(0));

    // Create multipart form data for file upload
    const boundary = "-------" + Date.now().toString(16);
    
    const metadata = JSON.stringify({
      name: fileName,
      parents: [folderId],
    });

    // Build multipart body
    const encoder = new TextEncoder();
    const parts = [
      encoder.encode(`--${boundary}\r\n`),
      encoder.encode(`Content-Type: application/json; charset=UTF-8\r\n\r\n`),
      encoder.encode(metadata + "\r\n"),
      encoder.encode(`--${boundary}\r\n`),
      encoder.encode(`Content-Type: ${mimeType}\r\n\r\n`),
      binaryContent,
      encoder.encode(`\r\n--${boundary}--`),
    ];

    // Combine all parts
    const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
    const body = new Uint8Array(totalLength);
    let offset = 0;
    for (const part of parts) {
      body.set(part, offset);
      offset += part.length;
    }

    // Upload file
    const uploadResponse = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,thumbnailLink,webViewLink",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body: body,
      }
    );

    const uploadData = await uploadResponse.json();

    if (uploadData.error) {
      return new Response(
        JSON.stringify({ error: uploadData.error.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For videos, fetch the Drive-generated thumbnail and return as base64
    // (thumbnailLink requires auth, so we fetch it server-side)
    let thumbnailData: string | null = null;
    if (mimeType.startsWith("video/") && uploadData.thumbnailLink) {
      try {
        const thumbResponse = await fetch(uploadData.thumbnailLink, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (thumbResponse.ok) {
          const thumbBytes = new Uint8Array(await thumbResponse.arrayBuffer());
          // Convert to base64
          let binary = "";
          for (let i = 0; i < thumbBytes.length; i++) {
            binary += String.fromCharCode(thumbBytes[i]);
          }
          thumbnailData = btoa(binary);
        }
      } catch (e) {
        console.warn("Failed to fetch Drive thumbnail:", e);
      }
    }

    return new Response(
      JSON.stringify({
        fileId: uploadData.id,
        fileName: uploadData.name,
        mimeType: uploadData.mimeType,
        thumbnailUrl: uploadData.thumbnailLink,
        webViewLink: uploadData.webViewLink,
        thumbnailData,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: unknown) {
    console.error("Error in drive-upload:", err);
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
