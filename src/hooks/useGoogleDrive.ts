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
      // Step 1: Ask edge function to init a resumable upload session
      const initResponse = await supabase.functions.invoke("drive-upload", {
        body: {
          action: "init-resumable",
          fileName: file.name,
          mimeType: file.type,
          folderId,
        },
      });

      if (initResponse.error) throw initResponse.error;
      const { uploadUri } = initResponse.data as { uploadUri: string; accessToken: string };

      if (!uploadUri) {
        throw new Error("Failed to get upload URI from server");
      }

      // Step 2: Upload the file directly to Google Drive using the resumable URI
      // This bypasses the Supabase body size limit entirely
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

      // Step 3: Finalize — set permissions and fetch thumbnail
      const finalizeResponse = await supabase.functions.invoke("drive-upload", {
        body: {
          action: "finalize",
          fileId: uploadData.id,
          mimeType: file.type,
        },
      });

      const finalizeData = finalizeResponse.data as { thumbnailData?: string } | null;

      return {
        fileId: uploadData.id as string,
        thumbnailUrl: uploadData.thumbnailLink as string | undefined,
        webViewLink: uploadData.webViewLink as string | undefined,
        thumbnailData: finalizeData?.thumbnailData ?? undefined,
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
