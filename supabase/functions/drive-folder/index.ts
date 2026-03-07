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
    const { action, folderName, parentId } = await req.json();
    
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const accessToken = await getValidAccessToken(supabase);

    if (action === "create") {
      if (!folderName) {
        return new Response(
          JSON.stringify({ error: "Folder name required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Parse folder path (e.g., "BabyJournal/BabyName")
      const parts = folderName.split("/").filter(Boolean);
      let currentParentId = parentId || "root";
      let finalFolderId = "";

      for (const part of parts) {
        // Check if folder already exists
        const searchQuery = `name='${part}' and mimeType='application/vnd.google-apps.folder' and '${currentParentId}' in parents and trashed=false`;
        
        const searchResponse = await fetch(
          `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(searchQuery)}&fields=files(id,name)`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        
        const searchData = await searchResponse.json();

        if (searchData.files && searchData.files.length > 0) {
          // Folder exists, use it
          currentParentId = searchData.files[0].id;
          finalFolderId = currentParentId;
        } else {
          // Create new folder
          const createResponse = await fetch("https://www.googleapis.com/drive/v3/files", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: part,
              mimeType: "application/vnd.google-apps.folder",
              parents: [currentParentId],
            }),
          });

          const createData = await createResponse.json();

          if (createData.error) {
            return new Response(
              JSON.stringify({ error: createData.error.message }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          currentParentId = createData.id;
          finalFolderId = createData.id;

          // Set "anyone with the link can view" on newly created folders
          // so videos can be played via Google Drive embed
          try {
            await fetch(
              `https://www.googleapis.com/drive/v3/files/${createData.id}/permissions`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ role: "reader", type: "anyone" }),
              }
            );
          } catch (e) {
            console.warn("Failed to set folder sharing:", e);
          }
        }
      }

      return new Response(
        JSON.stringify({ folderId: finalFolderId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "list") {
      const folderId = parentId || "root";
      const query = `'${folderId}' in parents and trashed=false`;
      
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,thumbnailLink,webViewLink)`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      const data = await response.json();

      return new Response(
        JSON.stringify({ files: data.files || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use 'create' or 'list'" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: unknown) {
    console.error("Error in drive-folder:", err);
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
