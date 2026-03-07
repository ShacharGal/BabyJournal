import { supabase } from "@/integrations/supabase/client";

const MAX_THUMB_WIDTH = 400;
const THUMB_QUALITY = 0.7;

/**
 * Generate a thumbnail from an image File using canvas,
 * upload it to the thumbnails storage bucket,
 * and return the public URL.
 */
export async function generateAndUploadThumbnail(
  file: File,
  entryId: string
): Promise<string | null> {
  // Only generate thumbnails for images
  if (!file.type.startsWith("image/")) return null;

  try {
    const thumbBlob = await resizeImage(file, MAX_THUMB_WIDTH, THUMB_QUALITY);
    const ext = "jpg";
    const path = `${entryId}.${ext}`;

    const { error } = await supabase.storage
      .from("thumbnails")
      .upload(path, thumbBlob, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (error) {
      console.warn("Thumbnail upload failed:", error);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from("thumbnails")
      .getPublicUrl(path);

    return urlData.publicUrl;
  } catch (e) {
    console.warn("Thumbnail generation failed:", e);
    return null;
  }
}

/**
 * Delete a thumbnail from storage by entry ID.
 */
export async function deleteThumbnail(entryId: string): Promise<void> {
  // Try common extensions
  const { error } = await supabase.storage
    .from("thumbnails")
    .remove([`${entryId}.jpg`]);

  if (error) console.warn("Thumbnail delete failed:", error);
}

/**
 * Upload a base64-encoded thumbnail (e.g. from Google Drive) to the thumbnails bucket.
 */
export async function uploadBase64Thumbnail(
  base64Data: string,
  entryId: string
): Promise<string | null> {
  try {
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: "image/jpeg" });
    const path = `${entryId}.jpg`;

    const { error } = await supabase.storage
      .from("thumbnails")
      .upload(path, blob, { contentType: "image/jpeg", upsert: true });

    if (error) {
      console.warn("Thumbnail upload failed:", error);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from("thumbnails")
      .getPublicUrl(path);

    return urlData.publicUrl;
  } catch (e) {
    console.warn("Base64 thumbnail upload failed:", e);
    return null;
  }
}

/**
 * Generate a thumbnail from a video file by capturing a frame at ~1 second.
 * Used as fallback when Google Drive thumbnail is not available.
 */
export async function generateVideoThumbnail(
  file: File,
  entryId: string
): Promise<string | null> {
  if (!file.type.startsWith("video/")) return null;

  try {
    const blob = await captureVideoFrame(file);
    const path = `${entryId}.jpg`;

    const { error } = await supabase.storage
      .from("thumbnails")
      .upload(path, blob, { contentType: "image/jpeg", upsert: true });

    if (error) {
      console.warn("Video thumbnail upload failed:", error);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from("thumbnails")
      .getPublicUrl(path);

    return urlData.publicUrl;
  } catch (e) {
    console.warn("Video thumbnail generation failed:", e);
    return null;
  }
}

function captureVideoFrame(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;

    video.onloadedmetadata = () => {
      // Seek to 1 second or 10% of duration (whichever is smaller)
      const seekTime = Math.min(1, video.duration * 0.1);
      video.currentTime = seekTime;
    };

    video.onseeked = () => {
      const canvas = document.createElement("canvas");
      canvas.width = Math.min(video.videoWidth, MAX_THUMB_WIDTH);
      const scale = canvas.width / video.videoWidth;
      canvas.height = Math.round(video.videoHeight * scale);

      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Canvas toBlob returned null"));
        },
        "image/jpeg",
        THUMB_QUALITY
      );
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load video"));
    };

    video.src = url;
  });
}

function resizeImage(file: File, maxWidth: number, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxWidth / img.width);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, w, h);

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Canvas toBlob returned null"));
        },
        "image/jpeg",
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };

    img.src = url;
  });
}
