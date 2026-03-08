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

// Make a file viewable by anyone with the link (needed for video preview)
async function makeFilePublic(fileId: string, accessToken: string) {
  await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        role: "reader",
        type: "anyone",
      }),
    }
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action } = body;

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const accessToken = await getValidAccessToken(supabase);

    // === Resumable upload: step 1 — init session, return upload URI ===
    if (action === "init-resumable") {
      const { fileName, mimeType, folderId } = body;

      if (!fileName || !mimeType || !folderId) {
        return new Response(
          JSON.stringify({ error: "fileName, mimeType, and folderId are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const metadata = JSON.stringify({
        name: fileName,
        parents: [folderId],
      });

      const initResponse = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,mimeType,thumbnailLink,webViewLink",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json; charset=UTF-8",
            "X-Upload-Content-Type": mimeType,
          },
          body: metadata,
        }
      );

      if (!initResponse.ok) {
        const errText = await initResponse.text();
        return new Response(
          JSON.stringify({ error: `Failed to init resumable upload: ${errText}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const uploadUri = initResponse.headers.get("Location");
      if (!uploadUri) {
        return new Response(
          JSON.stringify({ error: "No upload URI returned from Google" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ uploadUri, accessToken }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === Resumable upload: step 2 — finalize (set permissions, fetch thumbnail) ===
    if (action === "finalize") {
      const { fileId, mimeType: finalMimeType } = body;

      if (!fileId) {
        return new Response(
          JSON.stringify({ error: "fileId is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Make file publicly viewable (for video preview iframe)
      await makeFilePublic(fileId, accessToken);

      // For videos, try to fetch Drive-generated thumbnail
      let thumbnailData: string | null = null;
      if (finalMimeType?.startsWith("video/")) {
        // Fetch file metadata to get thumbnailLink
        const metaResponse = await fetch(
          `https://www.googleapis.com/drive/v3/files/${fileId}?fields=thumbnailLink`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (metaResponse.ok) {
          const meta = await metaResponse.json();
          if (meta.thumbnailLink) {
            try {
              const thumbResponse = await fetch(meta.thumbnailLink, {
                headers: { Authorization: `Bearer ${accessToken}` },
              });
              if (thumbResponse.ok) {
                const thumbBytes = new Uint8Array(await thumbResponse.arrayBuffer());
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
        }
      }

      return new Response(
        JSON.stringify({ ok: true, thumbnailData }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === Legacy: small-file multipart upload (kept for backward compat) ===
    const { fileName, mimeType, fileContent, folderId } = body;

    if (!fileName || !mimeType || !fileContent || !folderId) {
      return new Response(
        JSON.stringify({ error: "fileName, mimeType, fileContent, and folderId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Convert base64 to Uint8Array
    const binaryContent = Uint8Array.from(atob(fileContent), c => c.charCodeAt(0));

    const boundary = "-------" + Date.now().toString(16);
    const metadata = JSON.stringify({
      name: fileName,
      parents: [folderId],
    });

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

    const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
    const uploadBody = new Uint8Array(totalLength);
    let offset = 0;
    for (const part of parts) {
      uploadBody.set(part, offset);
      offset += part.length;
    }

    const uploadResponse = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,thumbnailLink,webViewLink",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body: uploadBody,
      }
    );

    const uploadData = await uploadResponse.json();

    if (uploadData.error) {
      return new Response(
        JSON.stringify({ error: uploadData.error.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Make file publicly viewable
    await makeFilePublic(uploadData.id, accessToken);

    // For videos, fetch the Drive-generated thumbnail
    let thumbnailData: string | null = null;
    if (mimeType.startsWith("video/") && uploadData.thumbnailLink) {
      try {
        const thumbResponse = await fetch(uploadData.thumbnailLink, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (thumbResponse.ok) {
          const thumbBytes = new Uint8Array(await thumbResponse.arrayBuffer());
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
