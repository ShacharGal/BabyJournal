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

/** Get a valid access token via the edge function (bypasses RLS) */
async function getValidAccessToken(): Promise<string> {
  console.log("[DriveUpload] Getting access token via edge function...");
  const response = await supabase.functions.invoke("drive-upload", {
    body: { action: "get-token" },
  });

  if (response.error) {
    // Try to extract the actual error message from the response body
    let detail = response.error.message;
    try {
      if (response.data && typeof response.data === "object" && response.data.error) {
        detail = response.data.error;
      }
    } catch (_) { /* ignore */ }
    console.error("[DriveUpload] get-token error:", detail, "raw:", response.error, "data:", response.data);
    throw new Error("Failed to get Google token: " + detail);
  }

  const { accessToken } = response.data as { accessToken: string };
  if (!accessToken) {
    console.error("[DriveUpload] No accessToken in response:", response.data);
    throw new Error("No access token returned from server");
  }

  console.log("[DriveUpload] Got access token");
  return accessToken;
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
      console.log("[DriveUpload] Starting upload:", file.name, file.type, `${(file.size / 1024 / 1024).toFixed(1)}MB`, "→ folder:", folderId);

      const accessToken = await getValidAccessToken();

      // Step 1: Init resumable upload session directly with Google Drive API
      console.log("[DriveUpload] Step 1: Init resumable upload session...");
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
        console.error("[DriveUpload] Step 1 FAILED:", initResponse.status, errText);
        throw new Error(`Failed to init upload (${initResponse.status}): ${errText}`);
      }

      const uploadUri = initResponse.headers.get("Location");
      console.log("[DriveUpload] Step 1 OK, upload URI:", uploadUri ? "received" : "MISSING");
      if (!uploadUri) {
        // Log all response headers for debugging
        const headers: Record<string, string> = {};
        initResponse.headers.forEach((v, k) => { headers[k] = v; });
        console.error("[DriveUpload] Response headers:", headers);
        throw new Error("No upload URI returned from Google (Location header missing — possible CORS issue)");
      }

      // Step 2: Upload file directly to Google Drive
      console.log("[DriveUpload] Step 2: Uploading file to Google Drive...");
      const uploadResponse = await fetch(uploadUri, {
        method: "PUT",
        headers: {
          "Content-Type": file.type,
        },
        body: file,
      });

      if (!uploadResponse.ok) {
        const errText = await uploadResponse.text();
        console.error("[DriveUpload] Step 2 FAILED:", uploadResponse.status, errText);
        throw new Error(`Drive upload failed (${uploadResponse.status}): ${errText}`);
      }

      const uploadData = await uploadResponse.json();
      console.log("[DriveUpload] Step 2 OK, fileId:", uploadData.id);

      // Step 3: Make file publicly viewable (needed for video preview iframe)
      console.log("[DriveUpload] Step 3: Setting public permissions...");
      try {
        const permResponse = await fetch(
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
        console.log("[DriveUpload] Step 3:", permResponse.ok ? "OK" : `FAILED (${permResponse.status})`);
      } catch (e) {
        console.warn("[DriveUpload] Step 3 FAILED:", e);
      }

      // Step 4: For videos, try to fetch Drive-generated thumbnail
      let thumbnailData: string | undefined;
      if (file.type.startsWith("video/") && uploadData.thumbnailLink) {
        console.log("[DriveUpload] Step 4: Fetching video thumbnail...");
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
            console.log("[DriveUpload] Step 4: Got thumbnail");
          } else {
            console.log("[DriveUpload] Step 4: No thumbnail yet (normal for newly uploaded videos)");
          }
        } catch (e) {
          console.warn("[DriveUpload] Step 4: Failed to fetch thumbnail:", e);
        }
      }

      console.log("[DriveUpload] DONE — fileId:", uploadData.id);
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
