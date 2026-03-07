import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface GooglePhoto {
  id: string;
  baseUrl: string;
  filename: string;
  mimeType: string;
  width: number;
  height: number;
  creationTime: string;
}

export function useGooglePhotos() {
  const [photos, setPhotos] = useState<GooglePhoto[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPhotos = useCallback(async (pageToken?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("photos-list", {
        body: { pageToken, pageSize: 30 },
      });

      if (fnError) throw fnError;
      if (data.error) throw new Error(data.error);

      if (pageToken) {
        setPhotos((prev) => [...prev, ...data.items]);
      } else {
        setPhotos(data.items);
      }
      setNextPageToken(data.nextPageToken);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load photos");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadMore = useCallback(() => {
    if (nextPageToken && !isLoading) {
      fetchPhotos(nextPageToken);
    }
  }, [nextPageToken, isLoading, fetchPhotos]);

  const reset = useCallback(() => {
    setPhotos([]);
    setNextPageToken(null);
    setError(null);
  }, []);

  return { photos, isLoading, error, fetchPhotos, loadMore, hasMore: !!nextPageToken, reset };
}

/** Download a Google Photos image and return it as a File */
export async function downloadGooglePhoto(photo: GooglePhoto): Promise<File> {
  // Append =d for full-resolution download
  const url = `${photo.baseUrl}=d`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to download photo");
  const blob = await res.blob();
  return new File([blob], photo.filename, { type: photo.mimeType });
}
