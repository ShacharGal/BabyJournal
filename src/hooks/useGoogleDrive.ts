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
      // Convert file to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]); // Remove data:... prefix
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const response = await supabase.functions.invoke("drive-upload", {
        body: {
          fileName: file.name,
          mimeType: file.type,
          fileContent: base64,
          folderId,
        },
      });
      
      if (response.error) throw response.error;
      return response.data as { 
        fileId: string; 
        thumbnailUrl?: string;
        webViewLink?: string;
      };
    },
  });
}
