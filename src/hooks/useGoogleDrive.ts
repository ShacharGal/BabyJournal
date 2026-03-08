import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type GoogleToken = Tables<"google_tokens">;

export function useGoogleConnection() {
  return useQuery({
    queryKey: ["google-connection"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("google_tokens")
        .select("*")
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });
}

export function useInitiateGoogleAuth() {
  return useMutation({
    mutationFn: async (redirectUri: string) => {
      const response = await supabase.functions.invoke("drive-auth", {
        body: { action: "get-auth-url", redirectUri },
      });

      if (response.error) throw response.error;
      return response.data as { url: string };
    },
  });
}

export function useExchangeGoogleCode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ code, redirectUri }: { code: string; redirectUri: string }) => {
      const response = await supabase.functions.invoke("drive-auth", {
        body: { action: "exchange-code", code, redirectUri },
      });

      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["google-connection"] });
    },
  });
}

export function useDisconnectGoogle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("google_tokens")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["google-connection"] });
    },
  });
}

export function useCreateDriveFolder() {
  return useMutation({
    mutationFn: async (folderName: string) => {
      const response = await supabase.functions.invoke("drive-folder", {
        body: { action: "create", folderName },
      });

      if (response.error) throw response.error;
      return response.data as { folderId: string };
    },
  });
}

/** Get a valid (non-expired) Google access token, refreshing via edge function if needed */
async function getValidAccessToken(): Promise<string> {
  const { data, error } = await supabase
    .from("google_tokens")
    .select("*")
    .limit(1)
    .single();

  if (error || !data) throw new Error("No Google token found");

  const expiresAt = new Date(data.expires_at);
  const bufferMs = 5 * 60 * 1000;

  if (expiresAt.getTime() - Date.now() > bufferMs) {
    // Token is still valid
    return data.access_token;
  }

  // Token expired — ask edge function to refresh it (this endpoint already exists)
  const response = await supabase.functions.invoke("drive-upload", {
    body: {
      // Trigger a dummy call that forces token refresh; we'll read the updated token after
      fileName: "__token_refresh__",
      mimeType: "text/plain",
      fileContent: "dGVzdA==", // "test" in base64
      folderId: "root",
    },
  });

  // Whether it succeeded or failed, re-read the token (refresh happens as side effect)
  const { data: refreshed } = await supabase
    .from("google_tokens")
    .select("access_token")
    .limit(1)
    .single();

  if (!refreshed) throw new Error("Failed to refresh Google token");
  return refreshed.access_token;
}

export function useUploadToDrive() {
  return useMutation({
    mutationFn: async ({
      file,
      folderId,
      onProgress
    }: {
      file: File;
      folderId: string;
      onProgress?: (progress: number) => void;
    }) => {
      const accessToken = await getValidAccessToken();

      // Step 1: Init resumable upload session directly with Google Drive API
      const metadata = JSON.stringify({
        name: file.name,
        parents: [folderId],
      });

      const initResponse = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,mimeType,thumbnailLink,webViewLink",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json; charset=UTF-8",
            "X-Upload-Content-Type": file.type,
            "X-Upload-Content-Length": String(file.size),
          },
          body: metadata,
        }
      );

      if (!initResponse.ok) {
        const errText = await initResponse.text();
        throw new Error(`Failed to init upload: ${errText}`);
      }

      const uploadUri = initResponse.headers.get("Location");
      if (!uploadUri) {
        throw new Error("No upload URI returned from Google");
      }

      // Step 2: Upload file directly to Google Drive
      const uploadResponse = await fetch(uploadUri, {
        method: "PUT",
        headers: {
          "Content-Type": file.type,
          "Content-Length": String(file.size),
        },
        body: file,
      });

      if (!uploadResponse.ok) {
        const errText = await uploadResponse.text();
        throw new Error(`Drive upload failed: ${errText}`);
      }

      const uploadData = await uploadResponse.json();

      // Step 3: Make file publicly viewable (needed for video preview iframe)
      try {
        await fetch(
          `https://www.googleapis.com/drive/v3/files/${uploadData.id}/permissions`,
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
        console.warn("Failed to set file permissions:", e);
      }

      // Step 4: For videos, try to fetch Drive-generated thumbnail
      let thumbnailData: string | undefined;
      if (file.type.startsWith("video/") && uploadData.thumbnailLink) {
        try {
          const thumbResponse = await fetch(uploadData.thumbnailLink, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (thumbResponse.ok) {
            const blob = await thumbResponse.blob();
            thumbnailData = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve((reader.result as string).split(",")[1]);
              reader.readAsDataURL(blob);
            });
          }
        } catch (e) {
          console.warn("Failed to fetch Drive thumbnail:", e);
        }
      }

      return {
        fileId: uploadData.id as string,
        thumbnailUrl: uploadData.thumbnailLink as string | undefined,
        webViewLink: uploadData.webViewLink as string | undefined,
        thumbnailData,
      };
    },
  });
}

export function useDeleteFromDrive() {
  return useMutation({
    mutationFn: async (fileId: string) => {
      const response = await supabase.functions.invoke("drive-delete", {
        body: { fileId },
      });

      if (response.error) throw response.error;
      return response.data;
    },
  });
}
